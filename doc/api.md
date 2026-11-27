### ApprovalFlowDesigner

审批流程设计器（默认导出）。点击节点打开配置弹窗，配置弹窗与节点补充表单设计都通过 `@kne/form-info` 的 `FormModal` 渲染。

#### 属性

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

#### 流程图数据

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

### FlowPreview

只读流程图，叠加运行时状态。

#### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| value | array | - | 流程图 |
| nodeStatus | object | {} | `{ [nodeId]: { status, handlers: [{ label, status }], text } }`，`status` 为 `passed` / `running` / `rejected` / `returned` / `canceled` / `skipped`，`text` 替换节点摘要 |
| onNodeClick | function(node, status) | - | 点击节点回调 |
| vertical | boolean | true | 纵向布局 |
| height | number | 480 | 画布高度 |
| className | string | - | 外层 className |

### ConditionEditor

结构化条件编辑器。

#### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|-------|------|
| value | object | - | 条件 `{ logic: 'and' \| 'or', rules: [{ field, op, value } \| 条件组] }` |
| onChange | function(condition) | - | 变化回调 |
| fields | array | [] | 可选字段 `[{ path, label, type, enum, enumNames, items }]`，通常由 `getAvailableContextFields` 生成 |
| maxDepth | number | 2 | 条件组最大嵌套层数 |

### 核心函数

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
