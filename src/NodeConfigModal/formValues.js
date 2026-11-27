import { NODE_TYPES, TASK_NODE_TYPES } from '../core/constants';
import { createNodeConfig } from '../core/nodeDefaults';
import { createEmptyCondition } from '../core/condition';

const emptyToNull = list => (Array.isArray(list) && list.length > 0 ? list : null);

/** 节点 → 表单数据（表单字段都是平铺的，复杂对象由自定义字段承载） */
export const nodeToFormValues = (node, { parentType } = {}) => {
  const config = Object.assign(createNodeConfig(node.type, { parentType }), node.config);
  const base = { title: node.title, key: node.key };
  if (TASK_NODE_TYPES.indexOf(node.type) > -1) {
    return Object.assign(base, {
      approvers: config.approvers,
      mode: config.mode,
      ratioType: config.ratio?.type || 'percent',
      ratioValue: config.ratio?.value,
      rejectRule: config.rejectRule,
      emptyPolicy: config.emptyPolicy,
      selfPolicy: config.selfPolicy,
      dedupe: config.dedupe,
      rejectAction: config.rejectAction,
      returnTargets: config.returnTargets,
      timeoutEnabled: !!config.timeout?.enabled,
      timeoutDuration: config.timeout?.duration,
      timeoutWorkdayOnly: config.timeout?.workdayOnly !== false,
      timeoutAction: config.timeout?.action,
      timeoutRemindBefore: config.timeout?.remindBefore,
      addSignEnabled: !!config.addSign?.enabled,
      addSignTypes: config.addSign?.types,
      addSignMaxDepth: config.addSign?.maxDepth,
      formEnabled: !!config.form?.enabled,
      form: { schema: config.form?.schema || null, dataSchema: config.form?.dataSchema || null },
      fillOn: config.form?.fillOn,
      allowDraft: config.form?.allowDraft !== false,
      contextMapping: config.contextMapping,
      aggregate: config.aggregate,
      editableFields: config.editableFields,
      visibleBlocks: config.visibleBlocks || [],
      hiddenFields: config.hiddenFields,
      requireAttachmentValid: !!config.requireAttachmentValid
    });
  }
  if (node.type === NODE_TYPES.CC) {
    return Object.assign(base, { recipients: config.recipients, visibleBlocks: config.visibleBlocks || [], hiddenFields: config.hiddenFields });
  }
  if (node.type === NODE_TYPES.PARALLEL) {
    return Object.assign(base, { joinRule: config.joinRule, joinCount: config.joinCount, branchRejectRule: config.branchRejectRule });
  }
  if (node.type === NODE_TYPES.BRANCH && parentType === NODE_TYPES.CONDITION) {
    return Object.assign(base, { isDefault: !!config.isDefault, condition: config.condition || createEmptyCondition() });
  }
  return base;
};

/** 表单数据 → 节点 */
export const formValuesToNode = (node, values, { parentType } = {}) => {
  const next = Object.assign({}, node, { title: values.title });
  if (values.key !== undefined) {
    next.key = values.key;
  }
  if (TASK_NODE_TYPES.indexOf(node.type) > -1) {
    next.config = Object.assign({}, node.config, {
      approvers: values.approvers || [],
      mode: values.mode,
      ratio: { type: values.ratioType, value: values.ratioValue },
      rejectRule: values.rejectRule,
      emptyPolicy: values.emptyPolicy,
      selfPolicy: values.selfPolicy,
      dedupe: values.dedupe,
      rejectAction: values.rejectAction,
      returnTargets: values.returnTargets || [],
      timeout: {
        enabled: !!values.timeoutEnabled,
        duration: values.timeoutDuration,
        workdayOnly: !!values.timeoutWorkdayOnly,
        action: values.timeoutAction,
        remindBefore: values.timeoutRemindBefore
      },
      addSign: { enabled: !!values.addSignEnabled, types: values.addSignTypes || [], maxDepth: values.addSignMaxDepth },
      form: {
        enabled: !!values.formEnabled,
        schema: values.form?.schema || null,
        dataSchema: values.form?.dataSchema || null,
        fillOn: values.fillOn || [],
        allowDraft: !!values.allowDraft
      },
      contextMapping: (values.contextMapping || []).filter(item => item && item.field && item.target),
      aggregate: values.aggregate,
      editableFields: values.editableFields || [],
      visibleBlocks: emptyToNull(values.visibleBlocks),
      hiddenFields: values.hiddenFields || [],
      requireAttachmentValid: !!values.requireAttachmentValid
    });
    return next;
  }
  if (node.type === NODE_TYPES.CC) {
    next.config = Object.assign({}, node.config, { recipients: values.recipients || [], visibleBlocks: emptyToNull(values.visibleBlocks), hiddenFields: values.hiddenFields || [] });
    return next;
  }
  if (node.type === NODE_TYPES.PARALLEL) {
    next.config = Object.assign({}, node.config, { joinRule: values.joinRule, joinCount: values.joinCount, branchRejectRule: values.branchRejectRule });
    return next;
  }
  if (node.type === NODE_TYPES.BRANCH && parentType === NODE_TYPES.CONDITION) {
    next.config = Object.assign({}, node.config, { isDefault: !!values.isDefault, condition: values.isDefault ? createEmptyCondition() : values.condition });
    return next;
  }
  return next;
};
