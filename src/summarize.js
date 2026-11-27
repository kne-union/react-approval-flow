import { NODE_TYPES, TASK_NODE_TYPES } from './core/constants';

const describeApprover = (approver, formatMessage) => {
  const sourceName = formatMessage({ id: `approverSource_${approver.source}` });
  switch (approver.source) {
    case 'user':
    case 'role':
      return (approver.items || []).map(item => item.label || item.value).join('、') || sourceName;
    case 'deptLeader':
      return approver.scope === 'specified' ? `${(approver.items || []).map(item => item.label || item.value).join('、')}${sourceName}` : formatMessage({ id: 'deptScopeInitiator' }) + sourceName;
    case 'superior':
      return formatMessage({ id: approver.continuous ? 'summarySuperiorContinuous' : 'summarySuperior' }, { level: approver.level || 1 });
    case 'formField':
      return formatMessage({ id: 'summaryFormField' }, { field: approver.field || '' });
    default:
      return sourceName;
  }
};

/** 生成节点卡片上的摘要文字 */
export const summarizeNode = (node, { formatMessage, parentType }) => {
  const config = node.config || {};
  if (TASK_NODE_TYPES.indexOf(node.type) > -1) {
    const approvers = (config.approvers || []).map(item => describeApprover(item, formatMessage));
    if (!approvers.length) {
      return formatMessage({ id: node.type === NODE_TYPES.HANDLE ? 'summaryNoHandler' : 'summaryNoApprover' });
    }
    const parts = [approvers.join('、')];
    if ((config.approvers || []).length > 1 || ['user', 'role'].indexOf(config.approvers[0]?.source) > -1) {
      parts.push(config.mode === 'ratio' ? formatMessage({ id: config.ratio?.type === 'count' ? 'summaryRatioCount' : 'summaryRatioPercent' }, { value: config.ratio?.value }) : formatMessage({ id: `mode_${config.mode || 'or'}` }));
    }
    config.form?.enabled && parts.push(formatMessage({ id: 'summaryWithForm' }));
    config.timeout?.enabled && parts.push(formatMessage({ id: 'summaryTimeout' }, { hours: config.timeout.duration }));
    return parts.join(' · ');
  }
  if (node.type === NODE_TYPES.CC) {
    const recipients = (config.recipients || []).map(item => describeApprover(item, formatMessage));
    return recipients.length ? recipients.join('、') : formatMessage({ id: 'summaryNoRecipient' });
  }
  if (node.type === NODE_TYPES.PARALLEL) {
    return formatMessage({ id: `summaryJoin_${config.joinRule || 'all'}` }, { count: config.joinCount });
  }
  if (node.type === NODE_TYPES.BRANCH) {
    if (parentType === NODE_TYPES.PARALLEL) {
      return node.content || formatMessage({ id: 'summaryParallelBranch' });
    }
    if (config.isDefault) {
      return formatMessage({ id: 'summaryDefaultBranch' });
    }
    const count = (config.condition?.rules || []).length;
    return count ? formatMessage({ id: 'summaryConditionCount' }, { count, logic: formatMessage({ id: config.condition.logic === 'or' ? 'logicAny' : 'logicAll' }) }) : formatMessage({ id: 'summaryNoCondition' });
  }
  return node.content;
};
