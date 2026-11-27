const { FlowPreview } = _ReactApprovalFlow;
const { Flex, Segmented, Descriptions, Card, Empty } = antd;
const { useState } = React;

const graph = [
  { id: 'start', key: 'start', type: 'start', title: '发起人' },
  {
    id: 'n_leader',
    key: 'leader',
    type: 'approval',
    title: '直属上级审批',
    config: { approvers: [{ source: 'superior', level: 1 }], mode: 'or' }
  },
  {
    id: 'n_condition',
    type: 'condition',
    title: '按金额分流',
    children: [
      [
        { id: 'b_large', type: 'branch', title: '大额', config: { condition: { logic: 'and', rules: [{ field: 'input.amount', op: 'gt', value: 20000 }] } } },
        { id: 'n_ceo', key: 'ceo', type: 'approval', title: '总经理审批', config: { approvers: [{ source: 'role', items: [{ value: 'r_ceo', label: '总经理' }] }], mode: 'or' } }
      ],
      [{ id: 'b_default', type: 'branch', title: '其他', config: { isDefault: true } }]
    ]
  },
  {
    id: 'n_finance',
    key: 'finance',
    type: 'approval',
    title: '财务会签',
    config: {
      approvers: [
        {
          source: 'user',
          items: [
            { value: 'u_1001', label: '张伟' },
            { value: 'u_1002', label: '李娜' }
          ]
        }
      ],
      mode: 'and'
    }
  },
  { id: 'end', key: 'end', type: 'end', title: '结束' }
];

// 运行时状态由后端实例接口返回，这里模拟三个阶段
const statusMap = {
  running: {
    n_leader: { status: 'passed', handlers: [{ label: '王强 已同意', status: 'passed' }] },
    b_large: { status: 'passed', text: '报销金额 32,000 > 20,000' },
    b_default: { status: 'skipped' },
    n_ceo: { status: 'running', handlers: [{ label: '赵敏 处理中', status: 'running' }] }
  },
  rejected: {
    n_leader: { status: 'passed', handlers: [{ label: '王强 已同意', status: 'passed' }] },
    b_large: { status: 'skipped' },
    b_default: { status: 'passed' },
    n_finance: {
      status: 'rejected',
      handlers: [
        { label: '张伟 已同意', status: 'passed' },
        { label: '李娜 已驳回', status: 'rejected' }
      ]
    }
  },
  passed: {
    n_leader: { status: 'passed', handlers: [{ label: '王强 已同意', status: 'passed' }] },
    b_large: { status: 'skipped' },
    b_default: { status: 'passed' },
    n_finance: {
      status: 'passed',
      handlers: [
        { label: '张伟 已同意', status: 'passed' },
        { label: '李娜 已同意', status: 'passed' }
      ]
    }
  }
};

const PreviewExample = () => {
  const [stage, setStage] = useState('running');
  const [active, setActive] = useState(null);
  return (
    <Flex vertical gap={12}>
      <Segmented
        value={stage}
        onChange={value => {
          setStage(value);
          setActive(null);
        }}
        options={[
          { label: '审批中', value: 'running' },
          { label: '已驳回', value: 'rejected' },
          { label: '已通过', value: 'passed' }
        ]}
      />
      <FlowPreview value={graph} nodeStatus={statusMap[stage]} onNodeClick={(node, status) => setActive({ node, status })} height={560} />
      <Card size="small" title="点击节点查看详情">
        {active ? (
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'title', label: '节点', children: active.node.title },
              { key: 'status', label: '状态', children: active.status?.status || '未到达' },
              { key: 'handlers', label: '处理记录', children: (active.status?.handlers || []).map(item => item.label).join('，') || '-' }
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </Flex>
  );
};

render(<PreviewExample />);
