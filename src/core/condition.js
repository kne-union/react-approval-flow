/**
 * 结构化条件：
 * { logic: 'and' | 'or', rules: [ { field, op, value } | { logic, rules } ] }
 * field 为 context 路径，如 input.amount、vars.approvedAmount、nodes.financeReview.remark
 */

export const OPERATORS = {
  eq: { valueType: 'single' },
  ne: { valueType: 'single' },
  gt: { valueType: 'single' },
  gte: { valueType: 'single' },
  lt: { valueType: 'single' },
  lte: { valueType: 'single' },
  between: { valueType: 'range' },
  in: { valueType: 'multiple' },
  notIn: { valueType: 'multiple' },
  contains: { valueType: 'single' },
  notContains: { valueType: 'single' },
  containsAny: { valueType: 'multiple' },
  empty: { valueType: 'none' },
  notEmpty: { valueType: 'none' }
};

const OPERATORS_BY_TYPE = {
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'empty', 'notEmpty'],
  integer: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'empty', 'notEmpty'],
  string: ['eq', 'ne', 'in', 'notIn', 'contains', 'notContains', 'empty', 'notEmpty'],
  boolean: ['eq', 'ne', 'empty', 'notEmpty'],
  array: ['contains', 'notContains', 'containsAny', 'empty', 'notEmpty'],
  enum: ['eq', 'ne', 'in', 'notIn', 'empty', 'notEmpty']
};

export const getOperatorsByField = field => {
  if (!field) {
    return [];
  }
  if (field.type !== 'array' && Array.isArray(field.enum) && field.enum.length > 0) {
    return OPERATORS_BY_TYPE.enum;
  }
  return OPERATORS_BY_TYPE[field.type] || OPERATORS_BY_TYPE.string;
};

export const createEmptyCondition = () => ({ logic: 'and', rules: [] });

export const isConditionGroup = rule => !!rule && Array.isArray(rule.rules);

export const getValueByPath = (target, path) => {
  if (!path) {
    return undefined;
  }
  return String(path)
    .split('.')
    .reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), target);
};

const isEmptyValue = value => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const toComparable = value => {
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  return value;
};

const looseEqual = (a, b) => {
  const left = toComparable(a);
  const right = toComparable(b);
  return left === right;
};

const asArray = value => (Array.isArray(value) ? value : isEmptyValue(value) ? [] : [value]);

const compare = (current, op, value) => {
  switch (op) {
    case 'empty':
      return isEmptyValue(current);
    case 'notEmpty':
      return !isEmptyValue(current);
    case 'eq':
      return looseEqual(current, value);
    case 'ne':
      return !looseEqual(current, value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (isEmptyValue(current) || isEmptyValue(value)) {
        return false;
      }
      const left = Number(current);
      const right = Number(value);
      if (isNaN(left) || isNaN(right)) {
        return false;
      }
      return { gt: left > right, gte: left >= right, lt: left < right, lte: left <= right }[op];
    }
    case 'between': {
      const [min, max] = asArray(value);
      if (isEmptyValue(current)) {
        return false;
      }
      const number = Number(current);
      return (isEmptyValue(min) || number >= Number(min)) && (isEmptyValue(max) || number <= Number(max));
    }
    case 'in':
      return asArray(value).some(item => looseEqual(current, item));
    case 'notIn':
      return !asArray(value).some(item => looseEqual(current, item));
    case 'contains':
      if (Array.isArray(current)) {
        return current.some(item => looseEqual(item, value));
      }
      return !isEmptyValue(current) && String(current).indexOf(String(value)) > -1;
    case 'notContains':
      if (Array.isArray(current)) {
        return !current.some(item => looseEqual(item, value));
      }
      return isEmptyValue(current) || String(current).indexOf(String(value)) === -1;
    case 'containsAny':
      return asArray(current).some(item => asArray(value).some(target => looseEqual(item, target)));
    default:
      return false;
  }
};

/** 读不到的字段按 null 求值，不抛错；空条件组视为成立 */
export const evaluateCondition = (condition, context) => {
  if (!condition) {
    return true;
  }
  if (isConditionGroup(condition)) {
    const rules = condition.rules.filter(Boolean);
    if (rules.length === 0) {
      return true;
    }
    const results = rules.map(rule => evaluateCondition(rule, context));
    return condition.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  }
  const current = getValueByPath(context, condition.field);
  return compare(current === undefined ? null : current, condition.op, condition.value);
};

/** 收集条件中引用的所有字段路径 */
export const collectConditionFieldPaths = condition => {
  const paths = [];
  const walk = rule => {
    if (!rule) {
      return;
    }
    if (isConditionGroup(rule)) {
      rule.rules.forEach(walk);
      return;
    }
    rule.field && paths.push(rule.field);
  };
  walk(condition);
  return paths;
};

export const isConditionComplete = condition => {
  if (!condition || !isConditionGroup(condition) || condition.rules.length === 0) {
    return false;
  }
  const walk = rule => {
    if (isConditionGroup(rule)) {
      return rule.rules.length > 0 && rule.rules.every(walk);
    }
    if (!rule.field || !rule.op) {
      return false;
    }
    const valueType = OPERATORS[rule.op]?.valueType;
    if (valueType === 'none') {
      return true;
    }
    if (valueType === 'range') {
      return Array.isArray(rule.value) && rule.value.some(item => !isEmptyValue(item));
    }
    return !isEmptyValue(rule.value);
  };
  return walk(condition);
};
