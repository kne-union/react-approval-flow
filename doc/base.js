const { default: ApprovalFlowDesigner, createFormDataSchema } = _ReactApprovalFlow;
const { createBlock, createField, defaultSchema } = _FormCreator;
const { Flex, Typography, Segmented, Tag } = antd;
const { useState } = React;

// 财务复核节点的补充表单（form-creator schema）
const financeFormSchema = Object.assign(defaultSchema(), {
  title: '财务复核',
  blocks: [
    createBlock('formInfo', {
      title: '复核信息',
      column: 1,
      list: [
        createField({ type: 'InputNumber', name: 'approvedAmount', label: '核定金额', rule: 'REQ' }),
        createField({ type: 'TextArea', name: 'remark', label: '复核意见' })
      ]
    })
  ]
});

const users = [
  { value: 'u_1001', label: '张伟（财务部）' },
  { value: 'u_1002', label: '李娜（财务部）' },
  { value: 'u_1003', label: '王强（行政部）' },
  { value: 'u_1004', label: '赵敏（总经办）' },
  { value: 'u_1005', label: '陈静（人力资源部）' }
];
const roles = [
  { value: 'r_finance', label: '财务专员' },
  { value: 'r_cfo', label: '财务总监' },
  { value: 'r_ceo', label: '总经理' }
];
const depts = [
  { value: 'd_finance', label: '财务部' },
  { value: 'd_admin', label: '行政部' },
  { value: 'd_rd', label: '研发中心' }
];

const searchFrom = list => keyword => new Promise(resolve => setTimeout(() => resolve(list.filter(item => item.label.indexOf(keyword) > -1)), 300));

// 功能声明「费用报销」的 inputSchema
const inputSchema = {
  type: 'object',
  title: '报销单',
  properties: {
    amount: { type: 'number', title: '报销金额' },
    category: { type: 'string', title: '费用类型', enum: ['travel', 'entertain', 'office'], enumNames: ['差旅', '招待', '办公'] },
    projectOwner: { type: 'string', format: 'user', title: '项目负责人' },
    invoiceCount: { type: 'integer', title: '发票张数' },
    urgent: { type: 'boolean', title: '是否加急' }
  },
  required: ['amount', 'category']
};

// 发起时附带的展示区块
const displaySchema = {
  blocks: [
    { key: 'summary', title: '报销概览' },
    { key: 'items', title: '费用明细' },
    { key: 'attachments', title: '发票附件' }
  ]
};

const defaultValue = [
  { id: 'start', key: 'start', type: 'start', title: '发起人' },
  {
    id: 'n_leader',
    key: 'leader',
    type: 'approval',
    title: '直属上级审批',
    config: {
      approvers: [{ source: 'superior', level: 1 }],
      mode: 'or',
      emptyPolicy: 'toAdmin',
      selfPolicy: 'autoPass',
      dedupe: 'once',
      rejectAction: 'returnInitiator',
      timeout: { enabled: true, duration: 24, action: 'remind', workdayOnly: true }
    }
  },
  {
    id: 'n_finance',
    key: 'finance',
    type: 'approval',
    title: '财务复核',
    config: {
      approvers: [{ source: 'role', items: [roles[0]] }],
      mode: 'or',
      form: {
        enabled: true,
        fillOn: ['approve'],
        schema: financeFormSchema,
        dataSchema: createFormDataSchema(financeFormSchema)
      },
      contextMapping: [{ field: 'approvedAmount', target: 'vars.approvedAmount' }],
      rejectAction: 'returnPrev'
    }
  },
  {
    id: 'n_condition',
    type: 'condition',
    title: '按核定金额分流',
    children: [
      [
        {
          id: 'b_large',
          type: 'branch',
          title: '大额',
          config: { condition: { logic: 'and', rules: [{ field: 'vars.approvedAmount', op: 'gt', value: 20000 }] } }
        },
        {
          id: 'n_ceo',
          key: 'ceo',
          type: 'approval',
          title: '总经理审批',
          config: { approvers: [{ source: 'role', items: [roles[2]] }], mode: 'or' }
        }
      ],
      [{ id: 'b_default', type: 'branch', title: '其他', config: { isDefault: true } }]
    ]
  },
  {
    id: 'n_parallel',
    type: 'parallel',
    title: '并行办理',
    config: { joinRule: 'all', branchRejectRule: 'rejectInstance' },
    children: [
      [
        { id: 'p_pay', type: 'branch', title: '出纳付款', config: {} },
        { id: 'n_pay', key: 'pay', type: 'handle', title: '出纳付款', config: { approvers: [{ source: 'user', items: [users[1]] }] } }
      ],
      [
        { id: 'p_archive', type: 'branch', title: '单据归档', config: {} },
        { id: 'n_archive', key: 'archive', type: 'handle', title: '单据归档', config: { approvers: [{ source: 'deptLeader', scope: 'initiatorDept' }] } }
      ]
    ]
  },
  {
    id: 'n_cc',
    key: 'notify',
    type: 'cc',
    title: '抄送',
    config: { recipients: [{ source: 'user', items: [users[3]] }] }
  },
  { id: 'end', key: 'end', type: 'end', title: '结束' }
];

const BaseExample = () => {
  const [value, setValue] = useState(defaultValue);
  const [issues, setIssues] = useState([]);
  const [readonly, setReadonly] = useState('edit');
  const [layout, setLayout] = useState('vertical');
  return (
    <Flex vertical gap={12}>
      <Flex gap={8} wrap>
        <Segmented
          value={readonly}
          onChange={setReadonly}
          options={[
            { label: '编辑', value: 'edit' },
            { label: '只读', value: 'readonly' }
          ]}
        />
        <Segmented
          value={layout}
          onChange={setLayout}
          options={[
            { label: '纵向', value: 'vertical' },
            { label: '横向', value: 'horizontal' }
          ]}
        />
      </Flex>
      <ApprovalFlowDesigner
        value={value}
        onChange={setValue}
        onIssuesChange={setIssues}
        readonly={readonly === 'readonly'}
        vertical={layout === 'vertical'}
        inputSchema={inputSchema}
        displaySchema={displaySchema}
        pickers={{
          user: { loadOptions: searchFrom(users) },
          role: { loadOptions: searchFrom(roles) },
          dept: { loadOptions: searchFrom(depts) }
        }}
        height={720}
      />
      <Typography.Text type="secondary">
        校验结果：
        {issues.filter(item => item.level === 'error').length ? (
          <Tag color="error">{issues.filter(item => item.level === 'error').length} 个错误</Tag>
        ) : (
          <Tag color="success">可以发布</Tag>
        )}
      </Typography.Text>
      <Typography.Paragraph>
        <pre className="approval-flow-example-json">{JSON.stringify(value, null, 2)}</pre>
      </Typography.Paragraph>
    </Flex>
  );
};

render(<BaseExample />);
