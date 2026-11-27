const { ConditionEditor, buildContextSchema, getAvailableContextFields, evaluateCondition, isConditionComplete } = _ReactApprovalFlow;
const { Flex, Card, Tag, Typography, InputNumber, Select, Space } = antd;
const { useMemo, useState } = React;

const inputSchema = {
  type: 'object',
  title: '报销单',
  properties: {
    amount: { type: 'number', title: '报销金额' },
    category: { type: 'string', title: '费用类型', enum: ['travel', 'entertain', 'office'], enumNames: ['差旅', '招待', '办公'] },
    tags: { type: 'array', title: '标签', items: { type: 'string', enum: ['overseas', 'client', 'urgent'], enumNames: ['境外', '客户相关', '加急'] } },
    urgent: { type: 'boolean', title: '是否加急' }
  }
};

// 上游的财务复核节点带补充表单，核定金额被映射到 vars.approvedAmount
const graph = [
  { id: 'start', key: 'start', type: 'start' },
  {
    id: 'n_finance',
    key: 'finance',
    type: 'approval',
    title: '财务复核',
    config: {
      mode: 'or',
      form: {
        enabled: true,
        dataSchema: { type: 'object', properties: { approvedAmount: { type: 'number', title: '核定金额' }, remark: { type: 'string', title: '复核意见' } } }
      },
      contextMapping: [{ field: 'approvedAmount', target: 'vars.approvedAmount' }]
    }
  },
  { id: 'end', key: 'end', type: 'end' }
];

const ConditionEditorExample = () => {
  const contextSchema = useMemo(() => buildContextSchema(inputSchema, graph), []);
  const fields = useMemo(() => getAvailableContextFields(contextSchema), [contextSchema]);
  const [condition, setCondition] = useState({
    logic: 'and',
    rules: [
      { field: 'input.amount', op: 'gt', value: 10000 },
      {
        logic: 'or',
        rules: [
          { field: 'input.category', op: 'eq', value: 'entertain' },
          { field: 'input.tags', op: 'contains', value: 'overseas' }
        ]
      }
    ]
  });
  const [amount, setAmount] = useState(18000);
  const [category, setCategory] = useState('travel');
  const [tags, setTags] = useState(['overseas']);
  const [approvedAmount, setApprovedAmount] = useState(16000);
  const context = {
    input: { amount, category, tags, urgent: false },
    initiator: { userId: 'u_1001', deptIds: ['d_finance'], roleIds: [] },
    nodes: { finance: { approvedAmount, remark: '票据齐全' } },
    vars: { approvedAmount }
  };
  const complete = isConditionComplete(condition);
  return (
    <Flex vertical gap={16}>
      <Card size="small" title="分支条件">
        <ConditionEditor value={condition} onChange={setCondition} fields={fields} />
      </Card>
      <Card size="small" title="用模拟的流程上下文试算">
        <Flex vertical gap={12}>
          <Space wrap>
            <span>报销金额</span>
            <InputNumber value={amount} onChange={setAmount} />
            <span>费用类型</span>
            <Select
              style={{ width: 120 }}
              value={category}
              onChange={setCategory}
              options={[
                { label: '差旅', value: 'travel' },
                { label: '招待', value: 'entertain' },
                { label: '办公', value: 'office' }
              ]}
            />
            <span>标签</span>
            <Select
              mode="multiple"
              style={{ width: 220 }}
              value={tags}
              onChange={setTags}
              options={[
                { label: '境外', value: 'overseas' },
                { label: '客户相关', value: 'client' },
                { label: '加急', value: 'urgent' }
              ]}
            />
            <span>核定金额</span>
            <InputNumber value={approvedAmount} onChange={setApprovedAmount} />
          </Space>
          <div>
            {complete ? (
              evaluateCondition(condition, context) ? (
                <Tag color="success">命中该分支</Tag>
              ) : (
                <Tag>不命中</Tag>
              )
            ) : (
              <Tag color="warning">条件未填写完整</Tag>
            )}
          </div>
          <Typography.Paragraph>
            <pre className="approval-flow-example-json">{JSON.stringify(condition, null, 2)}</pre>
          </Typography.Paragraph>
        </Flex>
      </Card>
    </Flex>
  );
};

render(<ConditionEditorExample />);
