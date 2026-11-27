const { validateFlow, hasBlockingIssue, buildContextSchema, getContextScope } = _ReactApprovalFlow;
const { Flex, Card, List, Tag, Typography } = antd;
const { useMemo } = React;

const inputSchema = {
  type: 'object',
  properties: {
    amount: { type: 'number', title: '报销金额' }
  }
};

// 一个故意配错的流程：节点标识重复、条件引用了分支里才有的变量、并行汇聚数量超出分支数
const graph = [
  { id: 'start', key: 'start', type: 'start' },
  {
    id: 'n_condition',
    type: 'condition',
    children: [
      [
        { id: 'b_large', type: 'branch', config: { condition: { logic: 'and', rules: [{ field: 'input.amount', op: 'gt', value: 20000 }] } } },
        {
          id: 'n_cfo',
          key: 'review',
          type: 'approval',
          title: '财务总监审批',
          config: {
            approvers: [{ source: 'role', items: [{ value: 'r_cfo', label: '财务总监' }] }],
            mode: 'or',
            form: { enabled: true, dataSchema: { type: 'object', properties: { approvedAmount: { type: 'number' } }, required: ['approvedAmount'] } },
            contextMapping: [{ field: 'approvedAmount', target: 'vars.approvedAmount' }],
            timeout: { enabled: true, duration: 24, action: 'autoPass' }
          }
        }
      ],
      [{ id: 'b_default', type: 'branch', config: { isDefault: true } }]
    ]
  },
  {
    id: 'n_parallel',
    type: 'parallel',
    config: { joinRule: 'count', joinCount: 3 },
    children: [
      [{ id: 'p1', type: 'branch', config: {} }, { id: 'n_hr', key: 'review', type: 'handle', title: '人事办理', config: { approvers: [] } }],
      [
        {
          id: 'p2',
          type: 'branch',
          config: {}
        }
      ]
    ]
  },
  {
    id: 'n_after',
    type: 'condition',
    children: [
      [{ id: 'b_check', type: 'branch', config: { condition: { logic: 'and', rules: [{ field: 'vars.approvedAmount', op: 'gt', value: 10000 }] } } }],
      [{ id: 'b_else', type: 'branch', config: { isDefault: true } }]
    ]
  },
  { id: 'end', key: 'end', type: 'end' }
];

const ValidateExample = () => {
  const issues = useMemo(() => validateFlow(graph, { inputSchema }), []);
  const contextSchema = useMemo(() => buildContextSchema(inputSchema, graph), []);
  const scope = useMemo(() => getContextScope(graph, 'b_check'), []);
  return (
    <Flex vertical gap={12}>
      <Card size="small" title={hasBlockingIssue(issues) ? '存在阻断发布的错误' : '可以发布'}>
        <List
          size="small"
          dataSource={issues}
          renderItem={item => (
            <List.Item>
              <Flex gap={8} align="center">
                <Tag color={item.level === 'error' ? 'error' : 'warning'}>{item.level}</Tag>
                <Typography.Text code>{item.code}</Typography.Text>
                <Typography.Text type="secondary">
                  {item.nodeId} {item.params ? JSON.stringify(item.params) : ''}
                </Typography.Text>
              </Flex>
            </List.Item>
          )}
        />
      </Card>
      <Card size="small" title="b_check 分支可引用的范围">
        <Typography.Paragraph>
          <pre className="approval-flow-example-json">{JSON.stringify(scope, null, 2)}</pre>
        </Typography.Paragraph>
      </Card>
      <Card size="small" title="推导出的 context schema">
        <Typography.Paragraph>
          <pre className="approval-flow-example-json">{JSON.stringify(contextSchema, null, 2)}</pre>
        </Typography.Paragraph>
      </Card>
    </Flex>
  );
};

render(<ValidateExample />);
