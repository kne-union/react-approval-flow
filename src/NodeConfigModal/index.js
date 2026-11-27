import { useMemo } from 'react';
import classnames from 'classnames';
import FormInfo, { FormModal, Input, Select, RadioGroup, InputNumber, Switch, CheckboxGroup, hooks } from '@kne/form-info';
import { Alert, Tag } from 'antd';
import { useIntl } from '@kne/react-intl';
import { useIsMobile } from '@kne/responsive-utils';
import { NODE_TYPES, TASK_NODE_TYPES, APPROVAL_MODES, JOIN_RULES, TIMEOUT_ACTIONS, EMPTY_POLICIES, REJECT_ACTIONS, ADD_SIGN_TYPES } from '../core/constants';
import { getContextScope } from '../core/validateFlow';
import { getAvailableContextFields, flattenSchemaFields } from '../core/contextSchema';
import { getBranchContainer, getNodeKey } from '../core/graph';
import { useDesignerContext } from '../context';
import ApproverField from '../fields/ApproverEditor';
import NodeFormField from '../fields/NodeFormField';
import ContextMappingField from '../fields/ContextMappingField';
import ConditionEditor from '../ConditionEditor';
import { nodeToFormValues, formValuesToNode } from './formValues';
import style from '../style.module.scss';

const { useOnChange } = hooks;

const ConditionField = props => {
  const render = useOnChange(props);
  return render(ConditionEditor);
};

const toOptions = (formatMessage, prefix, list) => list.map(value => ({ label: formatMessage({ id: `${prefix}_${value}` }), value }));

const show =
  predicate =>
  ({ openApi }) =>
    predicate(openApi?.data || {});

/**
 * 与 form-creator 属性弹窗一致的分区：带序号卡片 + 标题说明
 * lead 为控制整个分区的总开关，放在最前；toggles 为次要开关，放进末尾独立网格
 */
const Section = ({ id, column, lead = [], list = [], toggles = [] }) => {
  const { formatMessage } = useIntl();
  const items = [...lead, ...list.filter(Boolean)];
  if (toggles.length) {
    items.push(<FormInfo key="editor-toggles" block className={style['editor-toggles']} column={column} gap={12} list={toggles} />);
  }
  return <FormInfo title={formatMessage({ id })} subtitle={formatMessage({ id: `${id}Desc` })} column={column} list={items} />;
};

const useVisibilityOptions = () => {
  const { displaySchema, inputSchema } = useDesignerContext();
  return useMemo(
    () => ({
      blocks: (displaySchema?.blocks || []).map(block => ({ label: block.title || block.key, value: block.key })),
      inputFields: flattenSchemaFields(inputSchema, { prefix: 'input' }).map(field => ({ label: field.label || field.path, value: field.path }))
    }),
    [displaySchema, inputSchema]
  );
};

const VisibilitySection = ({ formatMessage, column }) => {
  const { blocks, inputFields } = useVisibilityOptions();
  return (
    <Section
      id="sectionVisibility"
      column={column}
      list={[
        <Select key="visibleBlocks" name="visibleBlocks" label={formatMessage({ id: 'visibleBlocks' })} mode="multiple" options={blocks} placeholder={formatMessage({ id: 'visibleBlocksAll' })} />,
        <Select key="hiddenFields" name="hiddenFields" label={formatMessage({ id: 'hiddenFields' })} mode="multiple" options={inputFields} />
      ]}
    />
  );
};

const TaskNodeSections = ({ node, formatMessage, contextFields, column }) => {
  const isApproval = node.type === NODE_TYPES.APPROVAL;
  const { inputSchema } = useDesignerContext();
  const editableOptions = flattenSchemaFields(inputSchema, { prefix: '' }).map(field => ({ label: field.label || field.path, value: field.path.replace(/^\./, '') }));
  const modes = isApproval ? APPROVAL_MODES : APPROVAL_MODES.filter(mode => mode !== 'ratio');
  return (
    <>
      <Section
        id={isApproval ? 'sectionApprover' : 'sectionHandler'}
        column={column}
        list={[
          <ApproverField key="approvers" name="approvers" label={formatMessage({ id: isApproval ? 'approvers' : 'handlers' })} rule="REQ" block userFields={contextFields} />,
          <RadioGroup key="mode" name="mode" label={formatMessage({ id: 'mode' })} block options={toOptions(formatMessage, 'mode', modes)} />,
          <RadioGroup key="ratioType" name="ratioType" label={formatMessage({ id: 'ratioType' })} options={toOptions(formatMessage, 'ratioType', ['percent', 'count'])} display={show(data => data.mode === 'ratio')} />,
          <InputNumber key="ratioValue" name="ratioValue" label={formatMessage({ id: 'ratioValue' })} min={1} rule="REQ" display={show(data => data.mode === 'ratio')} />,
          <RadioGroup key="rejectRule" name="rejectRule" label={formatMessage({ id: 'rejectRule' })} block options={toOptions(formatMessage, 'rejectRule', ['early', 'all'])} display={show(data => data.mode === 'ratio')} />,
          <Select key="aggregate" name="aggregate" label={formatMessage({ id: 'aggregate' })} options={toOptions(formatMessage, 'aggregate', ['list', 'last'])} display={show(data => data.mode !== 'or' && data.formEnabled)} />
        ]}
      />
      <Section
        id="sectionNodeForm"
        column={column}
        lead={[<Switch key="formEnabled" name="formEnabled" label={formatMessage({ id: 'formEnabled' })} block />]}
        list={[
          <NodeFormField key="form" name="form" label={formatMessage({ id: 'nodeForm' })} block display={show(data => data.formEnabled)} />,
          <CheckboxGroup key="fillOn" name="fillOn" label={formatMessage({ id: 'fillOn' })} options={toOptions(formatMessage, 'fillOn', isApproval ? ['approve', 'reject'] : ['approve'])} display={show(data => data.formEnabled)} />,
          <ContextMappingField key="contextMapping" name="contextMapping" label={formatMessage({ id: 'contextMapping' })} block display={show(data => data.formEnabled)} />,
          <Select key="editableFields" name="editableFields" label={formatMessage({ id: 'editableFields' })} mode="multiple" block options={editableOptions} />
        ]}
        toggles={[<Switch key="allowDraft" name="allowDraft" label={formatMessage({ id: 'allowDraft' })} display={show(data => data.formEnabled)} />]}
      />
      <Section
        id="sectionTimeout"
        column={column}
        lead={[<Switch key="timeoutEnabled" name="timeoutEnabled" label={formatMessage({ id: 'timeoutEnabled' })} block />]}
        list={[
          <InputNumber key="timeoutDuration" name="timeoutDuration" label={formatMessage({ id: 'timeoutDuration' })} min={1} rule="REQ" display={show(data => data.timeoutEnabled)} />,
          <Select key="timeoutAction" name="timeoutAction" label={formatMessage({ id: 'timeoutAction' })} options={toOptions(formatMessage, 'timeoutAction', TIMEOUT_ACTIONS)} display={show(data => data.timeoutEnabled)} />,
          <InputNumber key="timeoutRemindBefore" name="timeoutRemindBefore" label={formatMessage({ id: 'timeoutRemindBefore' })} min={0} display={show(data => data.timeoutEnabled)} />
        ]}
        toggles={[<Switch key="timeoutWorkdayOnly" name="timeoutWorkdayOnly" label={formatMessage({ id: 'timeoutWorkdayOnly' })} display={show(data => data.timeoutEnabled)} />]}
      />
      {isApproval && (
        <Section
          id="sectionAddSign"
          column={column}
          lead={[<Switch key="addSignEnabled" name="addSignEnabled" label={formatMessage({ id: 'addSignEnabled' })} block />]}
          list={[
            <CheckboxGroup key="addSignTypes" name="addSignTypes" label={formatMessage({ id: 'addSignTypes' })} options={toOptions(formatMessage, 'addSignType', ADD_SIGN_TYPES)} display={show(data => data.addSignEnabled)} />,
            <InputNumber key="addSignMaxDepth" name="addSignMaxDepth" label={formatMessage({ id: 'addSignMaxDepth' })} min={1} max={5} display={show(data => data.addSignEnabled)} />
          ]}
        />
      )}
      <Section
        id="sectionPolicy"
        column={column}
        list={[
          <Select key="emptyPolicy" name="emptyPolicy" label={formatMessage({ id: 'emptyPolicy' })} options={toOptions(formatMessage, 'emptyPolicy', EMPTY_POLICIES)} />,
          isApproval && <Select key="rejectAction" name="rejectAction" label={formatMessage({ id: 'rejectAction' })} options={toOptions(formatMessage, 'rejectAction', REJECT_ACTIONS)} />,
          <RadioGroup key="selfPolicy" name="selfPolicy" label={formatMessage({ id: 'selfPolicy' })} options={toOptions(formatMessage, 'selfPolicy', ['normal', 'autoPass'])} />,
          <RadioGroup key="dedupe" name="dedupe" label={formatMessage({ id: 'dedupe' })} options={toOptions(formatMessage, 'dedupe', ['every', 'once'])} />,
          <CheckboxGroup key="returnTargets" name="returnTargets" label={formatMessage({ id: 'returnTargets' })} block options={toOptions(formatMessage, 'returnTarget', ['initiator', 'prev', 'any'])} />
        ]}
        toggles={[<Switch key="requireAttachmentValid" name="requireAttachmentValid" label={formatMessage({ id: 'requireAttachmentValid' })} />]}
      />
      <VisibilitySection formatMessage={formatMessage} column={column} />
    </>
  );
};

const NodeSections = ({ node, parentType, formatMessage, contextFields, column }) => {
  if (TASK_NODE_TYPES.indexOf(node.type) > -1) {
    return <TaskNodeSections node={node} formatMessage={formatMessage} contextFields={contextFields} column={column} />;
  }
  if (node.type === NODE_TYPES.CC) {
    return (
      <>
        <Section id="sectionCc" column={column} list={[<ApproverField key="recipients" name="recipients" label={formatMessage({ id: 'recipients' })} block userFields={contextFields} />]} />
        <VisibilitySection formatMessage={formatMessage} column={column} />
      </>
    );
  }
  if (node.type === NODE_TYPES.PARALLEL) {
    return (
      <Section
        id="sectionParallel"
        column={column}
        list={[
          <RadioGroup key="joinRule" name="joinRule" label={formatMessage({ id: 'joinRule' })} block options={toOptions(formatMessage, 'joinRule', JOIN_RULES)} />,
          <InputNumber key="joinCount" name="joinCount" label={formatMessage({ id: 'joinCount' })} min={1} max={(node.children || []).length} rule="REQ" display={show(data => data.joinRule === 'count')} />,
          <RadioGroup key="branchRejectRule" name="branchRejectRule" label={formatMessage({ id: 'branchRejectRule' })} block options={toOptions(formatMessage, 'branchRejectRule', ['rejectInstance', 'branchFail'])} />
        ]}
      />
    );
  }
  if (node.type === NODE_TYPES.BRANCH && parentType === NODE_TYPES.CONDITION) {
    return (
      <Section
        id="sectionCondition"
        column={column}
        lead={[<Switch key="isDefault" name="isDefault" label={formatMessage({ id: 'isDefaultBranch' })} block />]}
        list={[<ConditionField key="condition" name="condition" label={formatMessage({ id: 'condition' })} block fields={contextFields} display={show(data => !data.isDefault)} />]}
      />
    );
  }
  return null;
};

const hasKey = node => [NODE_TYPES.BRANCH, NODE_TYPES.CONDITION, NODE_TYPES.PARALLEL].indexOf(node.type) === -1;

const NodeConfigModal = ({ node, open, onCancel, onSubmit, readonly }) => {
  const { formatMessage } = useIntl();
  const isMobile = useIsMobile();
  const column = isMobile ? 1 : 2;
  const { graph, contextSchema, renderModal, issues } = useDesignerContext();
  const parentType = useMemo(() => (node?.type === NODE_TYPES.BRANCH ? getBranchContainer(graph, node.id)?.type : null), [graph, node]);
  const contextFields = useMemo(() => {
    if (!node) {
      return [];
    }
    const scope = getContextScope(graph, node.id);
    return getAvailableContextFields(contextSchema, { allowedNodeKeys: scope.nodeKeys, allowedVarKeys: scope.varKeys });
  }, [graph, contextSchema, node]);
  if (!node) {
    return null;
  }
  const nodeIssues = (issues || []).filter(issue => issue.nodeId === node.id);
  const typeName = node.type === NODE_TYPES.BRANCH ? (parentType === NODE_TYPES.PARALLEL ? 'parallelBranchItem' : 'conditionBranchItem') : node.type;
  const typeLabel = formatMessage({ id: `nodeType_${typeName}` });
  return (
    <FormModal
      {...(renderModal ? { renderModal } : {})}
      open={open}
      className={style['property-modal']}
      width={isMobile ? 'calc(100vw - 32px)' : 760}
      destroyOnHidden
      title={formatMessage({ id: 'nodeConfigTitle' }, { type: typeLabel })}
      onCancel={onCancel}
      okText={formatMessage({ id: 'confirm' })}
      cancelText={formatMessage({ id: 'cancel' })}
      okButtonProps={{ disabled: readonly }}
      formProps={{
        data: nodeToFormValues(node, { parentType }),
        onSubmit: values => onSubmit(formValuesToNode(node, values, { parentType }))
      }}
    >
      <div className={style['editor-intro']}>
        <Tag className={classnames(style['editor-intro-tag'], style[`kind-${node.type === NODE_TYPES.BRANCH ? `${parentType}Branch` : node.type}`])}>{typeLabel}</Tag>
        <span>{formatMessage({ id: `nodeIntro_${typeName}` })}</span>
      </div>
      {nodeIssues.length > 0 && (
        <Alert
          className={style['editor-issues']}
          type={nodeIssues.some(issue => issue.level === 'error') ? 'error' : 'warning'}
          showIcon
          message={
            nodeIssues.length === 1 ? (
              formatMessage({ id: `issue_${nodeIssues[0].code}` }, nodeIssues[0].params)
            ) : (
              <ul className={style['alert-list']}>
                {nodeIssues.map((issue, index) => (
                  <li key={index}>{formatMessage({ id: `issue_${issue.code}` }, issue.params)}</li>
                ))}
              </ul>
            )
          }
        />
      )}
      <div className={style['node-config-form']}>
        <Section
          id="sectionBase"
          column={column}
          list={[
            <Input key="title" name="title" label={formatMessage({ id: 'nodeTitle' })} rule="REQ" />,
            hasKey(node) && <Input key="key" name="key" label={formatMessage({ id: 'nodeKey' })} rule="REQ" placeholder={formatMessage({ id: 'nodeKeyTips' }, { key: getNodeKey(node) })} />
          ]}
        />
        <NodeSections node={node} parentType={parentType} formatMessage={formatMessage} contextFields={contextFields} column={column} />
      </div>
    </FormModal>
  );
};

export default NodeConfigModal;
