import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition, getGuaranteedUpstreamNodes, buildContextSchema, getAvailableContextFields, validateFlow, getContextScope, createNodeConfig } from '../src/core/index.js';

const formNode = (id, { mapping = [], required = [], mode = 'or', aggregate } = {}) => ({
  id,
  key: id,
  type: 'approval',
  title: id,
  config: Object.assign(createNodeConfig('approval'), {
    approvers: [{ source: 'user', items: [{ value: 'u1', label: '张三' }] }],
    mode,
    aggregate,
    form: { enabled: true, schema: {}, dataSchema: { type: 'object', properties: { amount: { type: 'number', title: '金额' }, remark: { type: 'string', title: '备注' } }, required } },
    contextMapping: mapping
  })
});

const branch = (id, config = {}) => ({ id, type: 'branch', config });

const inputSchema = { type: 'object', properties: { amount: { type: 'number', title: '报销金额' }, reason: { type: 'string', title: '事由' } } };

describe('evaluateCondition', () => {
  const context = { input: { amount: 20000, tags: ['a', 'b'] }, vars: { approvedAmount: '18000' } };
  test('and / or 组合与数字比较', () => {
    assert.equal(evaluateCondition({ logic: 'and', rules: [{ field: 'input.amount', op: 'gt', value: 10000 }, { field: 'vars.approvedAmount', op: 'lte', value: 18000 }] }, context), true);
    assert.equal(evaluateCondition({ logic: 'or', rules: [{ field: 'input.amount', op: 'lt', value: 100 }, { logic: 'and', rules: [{ field: 'input.tags', op: 'contains', value: 'b' }] }] }, context), true);
  });
  test('读不到的字段按 null 处理', () => {
    assert.equal(evaluateCondition({ logic: 'and', rules: [{ field: 'nodes.missing.value', op: 'gt', value: 1 }] }, context), false);
    assert.equal(evaluateCondition({ logic: 'and', rules: [{ field: 'nodes.missing.value', op: 'empty' }] }, context), true);
  });
  test('between 与 in', () => {
    assert.equal(evaluateCondition({ logic: 'and', rules: [{ field: 'input.amount', op: 'between', value: [10000, 30000] }] }, context), true);
    assert.equal(evaluateCondition({ logic: 'and', rules: [{ field: 'input.amount', op: 'in', value: ['20000'] }] }, context), true);
  });
});

describe('getGuaranteedUpstreamNodes', () => {
  const graph = [
    { id: 'start', type: 'start' },
    formNode('a'),
    { id: 'c', type: 'condition', children: [[branch('c1'), formNode('b')], [branch('c2', { isDefault: true })]] },
    { id: 'p', type: 'parallel', config: { joinRule: 'all' }, children: [[branch('p1'), formNode('d')], [branch('p2'), formNode('e')]] },
    formNode('f'),
    { id: 'end', type: 'end' }
  ];
  test('条件分支内节点不计入，汇聚规则为 all 的并行分支计入', () => {
    assert.deepEqual(
      getGuaranteedUpstreamNodes(graph, 'f').map(n => n.id),
      ['start', 'a', 'c', 'p', 'p1', 'd', 'p2', 'e']
    );
  });
  test('分支内节点可以引用分支前和本分支前面的节点', () => {
    assert.deepEqual(
      getGuaranteedUpstreamNodes(graph, 'e').map(n => n.id),
      ['start', 'a', 'c', 'p2']
    );
    assert.deepEqual(getContextScope(graph, 'c1').nodeKeys, ['a']);
  });
});

describe('buildContextSchema', () => {
  test('合并 input、节点表单和 vars', () => {
    const graph = [{ id: 'start', type: 'start' }, formNode('finance', { mapping: [{ field: 'amount', target: 'vars.approvedAmount' }] }), formNode('hr', { mode: 'and' }), { id: 'end', type: 'end' }];
    const schema = buildContextSchema(inputSchema, graph);
    assert.equal(schema.properties.nodes.properties.finance.properties.amount.type, 'number');
    assert.equal(schema.properties.nodes.properties.hr.type, 'array');
    assert.equal(schema.properties.vars.properties.approvedAmount.type, 'number');
    const paths = getAvailableContextFields(schema, { allowedNodeKeys: ['finance'], allowedVarKeys: ['approvedAmount'] }).map(f => f.path);
    assert.ok(paths.includes('input.amount'));
    assert.ok(paths.includes('nodes.finance.remark'));
    assert.ok(paths.includes('vars.approvedAmount'));
    assert.ok(!paths.some(p => p.startsWith('nodes.hr')));
  });
});

describe('validateFlow', () => {
  const codes = issues => issues.map(i => i.code);
  test('合法流程无 error', () => {
    const graph = [
      { id: 'start', type: 'start' },
      formNode('finance', { mapping: [{ field: 'amount', target: 'vars.approvedAmount' }] }),
      { id: 'c', type: 'condition', children: [[branch('c1', { condition: { logic: 'and', rules: [{ field: 'vars.approvedAmount', op: 'gt', value: 10000 }] } }), formNode('boss')], [branch('c2', { isDefault: true })]] },
      { id: 'end', type: 'end' }
    ];
    assert.deepEqual(validateFlow(graph, { inputSchema }).filter(i => i.level === 'error'), []);
  });
  test('缺默认分支、条件引用不可达字段、审批人为空', () => {
    const empty = formNode('x');
    empty.config.approvers = [];
    const graph = [
      { id: 'start', type: 'start' },
      { id: 'c', type: 'condition', children: [[branch('c1', { condition: { logic: 'and', rules: [{ field: 'nodes.later.amount', op: 'gt', value: 1 }] } })], [branch('c2', { condition: { logic: 'and', rules: [] } })]] },
      empty,
      formNode('later'),
      { id: 'end', type: 'end' }
    ];
    const result = codes(validateFlow(graph, { inputSchema }));
    assert.ok(result.includes('defaultBranchRequired'));
    assert.ok(result.includes('conditionFieldUnreachable'));
    assert.ok(result.includes('conditionRequired'));
    assert.ok(result.includes('approverRequired'));
  });
  test('必填表单与自动通过冲突、并行分支 vars 冲突、汇聚数量非法', () => {
    const conflict = formNode('a', { required: ['amount'] });
    conflict.config.timeout = { enabled: true, action: 'autoPass', duration: 1 };
    const graph = [
      { id: 'start', type: 'start' },
      conflict,
      {
        id: 'p',
        type: 'parallel',
        config: { joinRule: 'count', joinCount: 5 },
        children: [[branch('p1'), formNode('b', { mapping: [{ field: 'amount', target: 'vars.total' }] })], [branch('p2'), formNode('d', { mapping: [{ field: 'amount', target: 'vars.total' }] })]]
      },
      { id: 'end', type: 'end' }
    ];
    const result = codes(validateFlow(graph, { inputSchema }));
    assert.ok(result.includes('requiredFormTimeoutAutoPass'));
    assert.ok(result.includes('varsConflict'));
    assert.ok(result.includes('joinCountInvalid'));
  });
  test('节点 key 重复', () => {
    const graph = [{ id: 'start', type: 'start' }, formNode('a'), Object.assign(formNode('b'), { key: 'a' }), { id: 'end', type: 'end' }];
    assert.ok(codes(validateFlow(graph)).includes('nodeKeyDuplicate'));
  });
});
