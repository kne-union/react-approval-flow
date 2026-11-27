<!--START_SECTION:DOC_MD-->

# react-approval-flow

### 描述

审批流程设计器：树形流程图编辑审批、办理、抄送、条件分支、并行分支节点，节点内嵌 form-creator 补充表单，基于流程上下文编辑分支条件，并提供流程校验、上下文 Schema 推导与运行状态预览

### 关键词

approval, workflow, flow-designer, 审批流, 流程设计器, 条件分支, 并行分支, form-creator, react

### 安装

```shell
npm i --save @kne/react-approval-flow
```

### 概述

审批流程设计器：基于 `@kne/react-flow-chart` 的树形流程图，编辑审批、办理、抄送、条件分支、并行分支节点；审批节点支持会签 / 或签 / 依次 / 按比例通过、加签、超时、驳回退回、空审批人与自审规则，可内嵌 `@kne/form-creator` 补充表单并把字段映射为共享变量。

分支条件只能引用一定会经过的上游数据：发起数据 `input`、发起人 `initiator`、上游节点表单 `nodes.<key>` 与共享变量 `vars.<key>`。包内同时导出无 UI 的核心函数（上下文 Schema 推导、条件求值、流程校验），可在后端复用同一套规则。


### 示例

#### 示例样式

```scss
.approval-flow-example-json {
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  font-size: 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
}
```

#### 示例代码

- 审批流程设计器(全屏)
- 费用报销流程：上级审批 → 财务复核（补充表单，核定金额写入 vars.approvedAmount）→ 按核定金额条件分流 → 并行办理 → 抄送；点击节点编辑配置，底部实时校验
- _ReactApprovalFlow(@kne/current-lib_react-approval-flow)[import * as _ReactApprovalFlow from "@kne/react-approval-flow"],(@kne/current-lib_react-approval-flow/dist/index.css)[import "@kne/react-approval-flow/dist/index.css"],_FormCreator(@kne/form-creator)[import * as _FormCreator from "@kne/form-creator"],antd(antd)[import antd from "antd"]

```jsx
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

```

- 条件编辑器
- 基于 buildContextSchema 推导出的上下文字段编辑嵌套条件，并用模拟上下文试算 evaluateCondition
- _ReactApprovalFlow(@kne/current-lib_react-approval-flow)[import * as _ReactApprovalFlow from "@kne/react-approval-flow"],(@kne/current-lib_react-approval-flow/dist/index.css)[import "@kne/react-approval-flow/dist/index.css"],antd(antd)[import antd from "antd"]

```jsx
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

```

- 运行状态预览
- 只读展示流程实例的节点状态与处理记录，切换审批中、已驳回、已通过三个阶段
- _ReactApprovalFlow(@kne/current-lib_react-approval-flow)[import * as _ReactApprovalFlow from "@kne/react-approval-flow"],(@kne/current-lib_react-approval-flow/dist/index.css)[import "@kne/react-approval-flow/dist/index.css"],antd(antd)[import antd from "antd"]

```jsx
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

```

- 流程校验与上下文推导
- 对一个故意配错的流程调用 validateFlow，展示问题列表、某分支可引用的上下文范围以及推导出的 context schema
- _ReactApprovalFlow(@kne/current-lib_react-approval-flow)[import * as _ReactApprovalFlow from "@kne/react-approval-flow"],antd(antd)[import antd from "antd"]

```jsx
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

```

### API

#### ApprovalFlowDesigner

审批流程设计器（默认导出）。点击节点打开配置弹窗，配置弹窗与节点补充表单设计都通过 `@kne/form-info` 的 `FormModal` 渲染。

##### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| value | array | - | 流程图（受控），格式见下方「流程图数据」；传空数组时显示只有开始、结束节点的默认流程 |
| defaultValue | array | - | 流程图初始值（非受控） |
| onChange | function(graph) | - | 流程图变化回调 |
| inputSchema | object | - | 功能声明的输入数据 JSON Schema，作为上下文中的 `input` |
| displaySchema | object | - | 发起时附带的展示区块 `{ blocks: [{ key, title }] }`，用于配置节点可见区块 |
| capabilities | object | `DEFAULT_CAPABILITIES` | 后端支持的能力 `{ tenant, org, role, user }`，决定可选的审批人来源 |
| pickers | object | - | 选择器 `{ user, role, dept }`，每项可为 `{ loadOptions(keyword) => Promise<[{ value, label }]> }` 或 `{ render({ value, onChange, multiple, type }) }` |
| renderModal | function | - | 透传给 `FormModal` 与 `FormCreator` 的弹窗渲染函数，由外部接管弹窗 |
| readonly | boolean | false | 只读，不能增删和编辑节点 |
| vertical | boolean | true | 纵向布局 |
| height | number | 640 | 画布高度 |
| showIssues | boolean | true | 在画布下方展示校验问题 |
| onIssuesChange | function(issues) | - | 校验结果变化回调 |
| className | string | - | 外层 className |

##### 流程图数据

数组按顺序排列节点；`condition` / `parallel` 节点的 `children` 为二维数组，每个分支的第一个节点是 `type: 'branch'` 的分支节点。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 节点 id |
| key | string | 节点标识，在上下文中以 `nodes.<key>` 引用，只能包含字母、数字和下划线 |
| type | string | `start` / `end` / `approval` / `handle` / `cc` / `condition` / `parallel` / `branch` |
| title | string | 节点名称 |
| config | object | 节点配置，见下表 |
| children | array[][] | 分支容器的分支列表 |

审批 / 办理节点 `config`：

| 字段 | 类型 | 描述 |
|------|------|------|
| approvers | array | 审批人来源 `[{ source, items, scope, level, continuous, field, multiple }]`，`source` 为 `user` / `role` / `deptLeader` / `superior` / `formField` / `initiatorSelect` / `initiator` |
| mode | string | `or` 或签 / `and` 会签 / `sequence` 依次 / `ratio` 按比例 |
| ratio | object | `{ type: 'percent' \| 'count', value }`，`mode` 为 `ratio` 时生效 |
| rejectRule | string | 按比例通过时的驳回判定 `early` / `all` |
| aggregate | string | 多人填写补充表单时写入方式 `list` / `last` |
| form | object | 补充表单 `{ enabled, schema, dataSchema, fillOn, allowDraft }`，`schema` 为 form-creator schema |
| contextMapping | array | 表单字段映射为共享变量 `[{ field, target: 'vars.xxx' }]` |
| timeout | object | `{ enabled, duration, workdayOnly, action, remindBefore }`，`action` 为 `remind` / `escalate` / `autoPass` / `autoReject` / `toAdmin` |
| addSign | object | 加签 `{ enabled, types: ['before', 'after', 'parallel'], maxDepth }`，仅审批节点 |
| emptyPolicy | string | 审批人为空时 `autoPass` / `toAdmin` / `reject` |
| selfPolicy | string | 审批人是发起人时 `normal` / `autoPass` |
| dedupe | string | 同一人重复出现时 `every` / `once` |
| rejectAction | string | 驳回后 `terminate` / `returnInitiator` / `returnPrev` / `returnNode` |
| returnTargets | array | 允许退回到 `initiator` / `prev` / `any` |
| editableFields | array | 允许处理人修改的 `input` 字段 |
| visibleBlocks / hiddenFields | array | 展示区块可见性与隐藏字段 |
| requireAttachmentValid | boolean | 附件失效时禁止同意 |

其他节点 `config`：抄送 `{ recipients }`；并行分支 `{ joinRule: 'all' | 'any' | 'count', joinCount, branchRejectRule: 'rejectInstance' | 'branchFail' }`；条件分支下的 `branch` 为 `{ isDefault, condition }`。

#### FlowPreview

只读流程图，叠加运行时状态。

##### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| value | array | - | 流程图 |
| nodeStatus | object | {} | `{ [nodeId]: { status, handlers: [{ label, status }], text } }`，`status` 为 `passed` / `running` / `rejected` / `returned` / `canceled` / `skipped`，`text` 替换节点摘要 |
| onNodeClick | function(node, status) | - | 点击节点回调 |
| vertical | boolean | true | 纵向布局 |
| height | number | 480 | 画布高度 |
| className | string | - | 外层 className |

#### ConditionEditor

结构化条件编辑器。

##### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| value | object | - | 条件 `{ logic: 'and' \| 'or', rules: [{ field, op, value } \| 条件组] }` |
| onChange | function(condition) | - | 变化回调 |
| fields | array | [] | 可选字段 `[{ path, label, type, enum, enumNames, items }]`，通常由 `getAvailableContextFields` 生成 |
| maxDepth | number | 2 | 条件组最大嵌套层数 |

#### 核心函数

无 UI 依赖，可在后端复用。

| 函数 | 说明 |
|------|------|
| buildContextSchema(inputSchema, graph, { labels }) | 推导上下文 JSON Schema `{ input, initiator, nodes, vars }` |
| getAvailableContextFields(contextSchema, { allowedNodeKeys, allowedVarKeys }) | 把上下文 Schema 摊平为条件可选字段 |
| flattenSchemaFields(schema, { prefix, labelPrefix }) | 摊平任意 JSON Schema |
| getContextScope(graph, nodeId) | 某节点处可引用的 `{ nodeKeys, varKeys }`：条件分支内的节点不计入，并行分支仅在 `joinRule` 为 `all` 时计入 |
| getGuaranteedUpstreamNodes(graph, nodeId) | 一定会经过的上游节点 |
| evaluateCondition(condition, context) | 条件求值，读不到的字段按 `null` 处理 |
| isConditionComplete(condition) | 条件是否填写完整 |
| getOperatorsByField(field) | 字段可用的操作符 |
| validateFlow(graph, { inputSchema }) | 校验流程，返回 `[{ nodeId, level: 'error' \| 'warning', code, params }]` |
| hasBlockingIssue(issues) | 是否存在阻断发布的错误 |
| createNodeConfig(type, { parentType }) | 节点默认配置 |
| createDefaultGraph({ labels }) | 只有开始、结束节点的默认流程 |
| createFormDataSchema(schema, { locale }) | 由 form-creator schema 生成带字段标题的数据 Schema |
| summarizeNode(node, { formatMessage, parentType }) | 节点摘要文案 |
| walkGraph / collectNodes / findNodeById / getNodeKey | 流程图遍历工具 |

常量：`NODE_TYPES`、`TASK_NODE_TYPES`、`APPROVER_SOURCES`、`DEFAULT_CAPABILITIES`、`APPROVAL_MODES`、`JOIN_RULES`、`TIMEOUT_ACTIONS`、`EMPTY_POLICIES`、`REJECT_ACTIONS`、`ADD_SIGN_TYPES`、`OPERATORS`。

<!--END_SECTION:DOC_MD-->
