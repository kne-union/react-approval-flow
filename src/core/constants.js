export const NODE_TYPES = {
  START: 'start',
  END: 'end',
  APPROVAL: 'approval',
  HANDLE: 'handle',
  CC: 'cc',
  CONDITION: 'condition',
  PARALLEL: 'parallel',
  BRANCH: 'branch'
};

export const TASK_NODE_TYPES = [NODE_TYPES.APPROVAL, NODE_TYPES.HANDLE];

export const BRANCH_CONTAINER_TYPES = [NODE_TYPES.CONDITION, NODE_TYPES.PARALLEL];

/** 审批人来源；capability 为 null 的来源不依赖 directory 能力，始终可用 */
export const APPROVER_SOURCES = [
  { value: 'user', capability: 'user', withItems: true },
  { value: 'role', capability: 'role', withItems: true },
  { value: 'deptLeader', capability: 'dept', withItems: true },
  { value: 'superior', capability: 'superior', withItems: false },
  { value: 'formField', capability: null, withItems: false },
  { value: 'initiatorSelect', capability: null, withItems: false },
  { value: 'initiator', capability: null, withItems: false }
];

export const DEFAULT_CAPABILITIES = ['user', 'role', 'dept', 'superior'];

export const APPROVAL_MODES = ['or', 'and', 'sequence', 'ratio'];

export const JOIN_RULES = ['all', 'any', 'count'];

export const TIMEOUT_ACTIONS = ['remind', 'escalate', 'autoPass', 'autoReject', 'toAdmin'];

export const EMPTY_POLICIES = ['autoPass', 'toAdmin', 'reject'];

export const REJECT_ACTIONS = ['terminate', 'returnInitiator', 'returnPrev', 'returnNode'];

export const ADD_SIGN_TYPES = ['before', 'after', 'parallel'];

export const VARS_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const NODE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
