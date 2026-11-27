import { NODE_TYPES, TASK_NODE_TYPES, NODE_KEY_PATTERN, VARS_KEY_PATTERN } from './constants';
import { walkGraph, collectNodes, getGuaranteedUpstreamNodes, getBranchContainer, getNodeKey, isBranchContainer } from './graph';
import { collectConditionFieldPaths, isConditionComplete } from './condition';
import { flattenSchemaFields } from './contextSchema';

const getVarKey = target => String(target || '').replace(/^vars\./, '');

const hasForm = node => TASK_NODE_TYPES.indexOf(node.type) > -1 && !!node.config?.form?.enabled;

const getNodeVarKeys = node => (hasForm(node) ? (node.config.contextMapping || []).map(item => getVarKey(item.target)).filter(Boolean) : []);

/** 某节点处可以引用的 context 范围：一定会经过的上游节点 key，以及它们写入的 vars key */
export const getContextScope = (graph, nodeId) => {
  const upstream = getGuaranteedUpstreamNodes(graph, nodeId);
  const nodeKeys = upstream.filter(hasForm).map(getNodeKey);
  const varKeys = [];
  upstream.forEach(node => {
    getNodeVarKeys(node).forEach(key => varKeys.indexOf(key) === -1 && varKeys.push(key));
  });
  return { nodeKeys, varKeys };
};

const isFieldInScope = (path, { scope, inputPaths }) => {
  const [root, key] = String(path).split('.');
  if (root === 'input') {
    return !inputPaths || inputPaths.indexOf(path) > -1;
  }
  if (root === 'initiator') {
    return true;
  }
  if (root === 'nodes') {
    return scope.nodeKeys.indexOf(key) > -1;
  }
  if (root === 'vars') {
    return scope.varKeys.indexOf(key) > -1;
  }
  return false;
};

const hasRequiredFormField = node => {
  const dataSchema = node.config?.form?.dataSchema;
  return hasForm(node) && Array.isArray(dataSchema?.required) && dataSchema.required.length > 0;
};

/**
 * 校验流程图，返回 [{ nodeId, level: 'error' | 'warning', code, params }]
 * 只要存在 level 为 error 的项，流程就不能发布
 */
export const validateFlow = (graph, { inputSchema } = {}) => {
  const issues = [];
  const push = (node, code, params = {}, level = 'error') => issues.push({ nodeId: node?.id || null, level, code, params });
  const inputPaths = inputSchema ? flattenSchemaFields(inputSchema, { prefix: 'input' }).map(item => item.path) : null;

  if (!Array.isArray(graph) || graph.length === 0) {
    push(null, 'graphEmpty');
    return issues;
  }

  const keyCount = {};
  walkGraph(graph, node => {
    if (node.type === NODE_TYPES.BRANCH) {
      return;
    }
    const key = getNodeKey(node);
    keyCount[key] = (keyCount[key] || 0) + 1;
    if (node.key !== undefined && !NODE_KEY_PATTERN.test(node.key)) {
      push(node, 'nodeKeyInvalid', { key: node.key });
    }
  });
  walkGraph(graph, node => {
    if (node.type !== NODE_TYPES.BRANCH && keyCount[getNodeKey(node)] > 1) {
      push(node, 'nodeKeyDuplicate', { key: getNodeKey(node) });
    }
  });

  walkGraph(graph, node => {
    const config = node.config || {};
    if (TASK_NODE_TYPES.indexOf(node.type) > -1) {
      if (!Array.isArray(config.approvers) || config.approvers.length === 0) {
        push(node, 'approverRequired');
      }
      const scope = getContextScope(graph, node.id);
      (config.approvers || []).forEach(approver => {
        if (approver.source === 'formField' && approver.field && !isFieldInScope(approver.field, { scope, inputPaths })) {
          push(node, 'approverFieldUnreachable', { field: approver.field });
        }
        if (['user', 'role', 'deptLeader'].indexOf(approver.source) > -1 && approver.scope !== 'initiatorDept' && !(approver.items || []).length) {
          push(node, 'approverItemsRequired', { source: approver.source });
        }
      });
      if (config.mode === 'ratio') {
        const value = Number(config.ratio?.value);
        const valid = config.ratio?.type === 'count' ? Number.isInteger(value) && value >= 1 : value > 0 && value <= 100;
        valid || push(node, 'ratioInvalid');
      }
      if (hasRequiredFormField(node)) {
        if (config.timeout?.enabled && config.timeout.action === 'autoPass') {
          push(node, 'requiredFormTimeoutAutoPass');
        }
        if (config.emptyPolicy === 'autoPass') {
          push(node, 'requiredFormEmptyAutoPass');
        }
        if (config.selfPolicy === 'autoPass') {
          push(node, 'requiredFormSelfAutoPass', {}, 'warning');
        }
      }
      if (hasForm(node)) {
        if (!config.form.dataSchema) {
          push(node, 'formEmpty');
        }
        const fieldNames = Object.keys(config.form.dataSchema?.properties || {});
        (config.contextMapping || []).forEach(({ field, target }) => {
          const varKey = getVarKey(target);
          if (!VARS_KEY_PATTERN.test(varKey)) {
            push(node, 'varsKeyInvalid', { key: target });
          }
          if (field && fieldNames.indexOf(field) === -1) {
            push(node, 'mappingFieldMissing', { field });
          }
        });
      }
    }
    if (node.type === NODE_TYPES.CC && !(config.recipients || []).length) {
      push(node, 'ccRecipientRequired', {}, 'warning');
    }
    if (node.type === NODE_TYPES.CONDITION) {
      const branches = (node.children || []).map(branch => branch[0]).filter(Boolean);
      const defaultCount = branches.filter(branch => branch.config?.isDefault).length;
      if (defaultCount === 0) {
        push(node, 'defaultBranchRequired');
      }
      if (defaultCount > 1) {
        push(node, 'defaultBranchMultiple');
      }
    }
    if (node.type === NODE_TYPES.PARALLEL) {
      const branchCount = (node.children || []).length;
      if (config.joinRule === 'count') {
        const joinCount = Number(config.joinCount);
        if (!Number.isInteger(joinCount) || joinCount < 1 || joinCount > branchCount) {
          push(node, 'joinCountInvalid', { max: branchCount });
        }
      }
      const owners = {};
      (node.children || []).forEach((branch, branchIndex) => {
        collectNodes(branch).forEach(child => {
          getNodeVarKeys(child).forEach(key => {
            owners[key] = owners[key] || new Set();
            owners[key].add(branchIndex);
          });
        });
      });
      Object.keys(owners).forEach(key => {
        owners[key].size > 1 && push(node, 'varsConflict', { key });
      });
    }
    if (node.type === NODE_TYPES.BRANCH) {
      const container = getBranchContainer(graph, node.id);
      if (container?.type === NODE_TYPES.CONDITION && !config.isDefault) {
        if (!isConditionComplete(config.condition)) {
          push(node, 'conditionRequired');
        } else {
          const scope = getContextScope(graph, node.id);
          collectConditionFieldPaths(config.condition).forEach(field => {
            isFieldInScope(field, { scope, inputPaths }) || push(node, 'conditionFieldUnreachable', { field });
          });
        }
      }
    }
  });

  if (!graph.some(node => node.type === NODE_TYPES.START) || !graph.some(node => node.type === NODE_TYPES.END)) {
    push(null, 'startEndRequired');
  }
  if (!collectNodes(graph, node => TASK_NODE_TYPES.indexOf(node.type) > -1 || isBranchContainer(node)).length) {
    push(null, 'noTaskNode', {}, 'warning');
  }

  return issues;
};

export const hasBlockingIssue = issues => (issues || []).some(issue => issue.level === 'error');
