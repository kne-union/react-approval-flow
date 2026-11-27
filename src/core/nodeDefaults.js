import { NODE_TYPES } from './constants';
import { createEmptyCondition } from './condition';

const randomKey = prefix => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const createTaskNodeConfig = () => ({
  approvers: [],
  mode: 'or',
  ratio: { type: 'percent', value: 60 },
  rejectRule: 'early',
  emptyPolicy: 'toAdmin',
  selfPolicy: 'normal',
  dedupe: 'every',
  rejectAction: 'terminate',
  returnTargets: ['initiator', 'prev'],
  timeout: { enabled: false, duration: 24, workdayOnly: true, action: 'remind', remindBefore: 0 },
  addSign: { enabled: false, types: ['before', 'after'], maxDepth: 1 },
  form: { enabled: false, schema: null, dataSchema: null, fillOn: ['approve'], allowDraft: true },
  contextMapping: [],
  aggregate: 'list',
  editableFields: [],
  visibleBlocks: null,
  hiddenFields: [],
  requireAttachmentValid: false
});

export const createNodeConfig = (type, { parentType } = {}) => {
  switch (type) {
    case NODE_TYPES.APPROVAL:
      return createTaskNodeConfig();
    case NODE_TYPES.HANDLE:
      return Object.assign(createTaskNodeConfig(), { mode: 'or', form: { enabled: true, schema: null, dataSchema: null, fillOn: ['approve'], allowDraft: true } });
    case NODE_TYPES.CC:
      return { recipients: [], visibleBlocks: null, hiddenFields: [] };
    case NODE_TYPES.PARALLEL:
      return { joinRule: 'all', joinCount: 1, branchRejectRule: 'rejectInstance' };
    case NODE_TYPES.BRANCH:
      return parentType === NODE_TYPES.CONDITION ? { condition: createEmptyCondition(), isDefault: false } : {};
    default:
      return {};
  }
};

export const createNodeKey = type => randomKey(type);

export const createDefaultGraph = ({ labels = {} } = {}) => [
  { id: 'start', key: 'start', type: NODE_TYPES.START, title: labels.start || '发起人' },
  { id: 'end', key: 'end', type: NODE_TYPES.END, title: labels.end || '结束' }
];
