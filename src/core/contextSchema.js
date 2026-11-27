import { collectNodes, getNodeKey } from './graph';
import { TASK_NODE_TYPES } from './constants';

export const DEFAULT_CONTEXT_LABELS = {
  input: '发起数据',
  initiator: '发起人',
  initiatorUserId: '发起人',
  initiatorDeptIds: '发起人部门',
  initiatorRoleIds: '发起人角色',
  nodes: '节点表单',
  vars: '共享变量',
  handler: '处理人'
};

const getInitiatorSchema = labels => ({
  type: 'object',
  title: labels.initiator,
  properties: {
    userId: { type: 'string', title: labels.initiatorUserId },
    deptIds: { type: 'array', title: labels.initiatorDeptIds, items: { type: 'string' } },
    roleIds: { type: 'array', title: labels.initiatorRoleIds, items: { type: 'string' } }
  }
});

const isNodeWithForm = node => TASK_NODE_TYPES.indexOf(node.type) > -1 && node.config?.form?.enabled && node.config.form.dataSchema;

/** 多人节点按人收集时，context.nodes.<key> 为数组 */
export const isNodeDataList = node => {
  const mode = node.config?.mode || 'or';
  return mode !== 'or' && (node.config?.aggregate || 'list') === 'list';
};

const getNodeDataSchema = (node, labels) => {
  const dataSchema = node.config.form.dataSchema;
  const title = node.title || getNodeKey(node);
  if (isNodeDataList(node)) {
    return {
      type: 'array',
      title,
      items: {
        type: 'object',
        properties: { userId: { type: 'string', title: labels.handler }, data: dataSchema }
      }
    };
  }
  return Object.assign({}, dataSchema, { title });
};

/**
 * 根据功能声明的 inputSchema 与流程图推导 context 的 JSON Schema
 * 结构：{ input, initiator, nodes: { [nodeKey]: formData }, vars }
 */
export const buildContextSchema = (inputSchema, graph, options = {}) => {
  const labels = Object.assign({}, DEFAULT_CONTEXT_LABELS, options.labels);
  const nodesProperties = {};
  const varsProperties = {};
  collectNodes(graph, isNodeWithForm).forEach(node => {
    const key = getNodeKey(node);
    nodesProperties[key] = getNodeDataSchema(node, labels);
    const fieldSchemas = node.config.form.dataSchema.properties || {};
    (node.config.contextMapping || []).forEach(({ field, target }) => {
      if (!field || !target) {
        return;
      }
      const varKey = String(target).replace(/^vars\./, '');
      const fieldSchema = fieldSchemas[field] || { type: 'string' };
      varsProperties[varKey] = Object.assign({}, fieldSchema, { title: fieldSchema.title ? `${fieldSchema.title}（${varKey}）` : varKey });
    });
  });
  return {
    type: 'object',
    properties: {
      input: Object.assign({ type: 'object', properties: {} }, inputSchema, { title: inputSchema?.title || labels.input }),
      initiator: getInitiatorSchema(labels),
      nodes: { type: 'object', title: labels.nodes, properties: nodesProperties },
      vars: { type: 'object', title: labels.vars, properties: varsProperties }
    }
  };
};

/**
 * 把 JSON Schema 摊平成可选字段列表：[{ path, label, type, enum, enumNames }]
 * 只展开 object，数组作为整体字段（可用 contains / empty 等操作符）
 */
export const flattenSchemaFields = (schema, { prefix = '', labelPrefix = '' } = {}) => {
  const fields = [];
  const walk = (current, path, labels) => {
    if (!current) {
      return;
    }
    if (current.type === 'object' || current.properties) {
      Object.keys(current.properties || {}).forEach(name => {
        const child = current.properties[name];
        walk(child, path ? `${path}.${name}` : name, labels.concat([child?.title || name]));
      });
      return;
    }
    fields.push({
      path,
      label: labels.join(' / '),
      type: current.type || 'string',
      format: current.format,
      enum: current.enum,
      enumNames: current.enumNames || (current.oneOf || []).map(item => item.title),
      items: current.items
    });
  };
  walk(schema, prefix, labelPrefix ? [labelPrefix] : []);
  return fields;
};

/**
 * 某节点（或分支）处可引用的 context 字段
 * allowedNodeKeys 为一定会经过的上游节点 key；为 null 时不过滤
 */
export const getAvailableContextFields = (contextSchema, { allowedNodeKeys = null, allowedVarKeys = null } = {}) => {
  const properties = contextSchema?.properties || {};
  const nodesProperties = properties.nodes?.properties || {};
  const varsProperties = properties.vars?.properties || {};
  const pickProperties = (source, allowed) => {
    if (!allowed) {
      return source;
    }
    return Object.keys(source)
      .filter(key => allowed.indexOf(key) > -1)
      .reduce((result, key) => Object.assign(result, { [key]: source[key] }), {});
  };
  return [
    ...flattenSchemaFields(properties.input, { prefix: 'input', labelPrefix: properties.input?.title }),
    ...flattenSchemaFields(properties.initiator, { prefix: 'initiator', labelPrefix: properties.initiator?.title }),
    ...flattenSchemaFields({ type: 'object', properties: pickProperties(nodesProperties, allowedNodeKeys) }, { prefix: 'nodes', labelPrefix: properties.nodes?.title }),
    ...flattenSchemaFields({ type: 'object', properties: pickProperties(varsProperties, allowedVarKeys) }, { prefix: 'vars', labelPrefix: properties.vars?.title })
  ];
};
