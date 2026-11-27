import { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { Flex, Tooltip, Typography } from 'antd';
import { CloseCircleFilled, ExclamationCircleFilled, RightOutlined } from '@ant-design/icons';
import ReactFlowChart, { treeUtil } from '@kne/react-flow-chart';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import { DesignerProvider } from '../context';
import { NODE_TYPES, DEFAULT_CAPABILITIES } from '../core/constants';
import { walkGraph, findNodeById, isBranchContainer } from '../core/graph';
import { buildContextSchema } from '../core/contextSchema';
import { validateFlow } from '../core/validateFlow';
import { createNodeConfig, createNodeKey, createDefaultGraph } from '../core/nodeDefaults';
import { summarizeNode } from '../summarize';
import NodeConfigModal from '../NodeConfigModal';
import useContextLabels from '../useContextLabels';
import { NodeKindIcon, getNodeKind, getKindClassName, NODE_KIND_ICONS } from '../nodeKinds';
import style from '../style.module.scss';

const { Text } = Typography;

export const getParentTypeMap = graph => {
  const map = {};
  walkGraph(graph, node => {
    if (isBranchContainer(node)) {
      (node.children || []).forEach(branch => branch[0] && (map[branch[0].id] = node.type));
    }
  });
  return map;
};

/** 新建的条件分支默认把最后一条设为默认分支 */
const ensureDefaultBranch = (prevGraph, nextGraph) => {
  const prevIds = new Set();
  walkGraph(prevGraph || [], node => prevIds.add(node.id));
  const mark = list =>
    (list || []).map(node => {
      if (!isBranchContainer(node)) {
        return node;
      }
      let children = (node.children || []).map(mark);
      if (node.type === NODE_TYPES.CONDITION && !prevIds.has(node.id) && !children.some(branch => branch[0]?.config?.isDefault)) {
        children = children.map((branch, index) => (index === children.length - 1 ? [Object.assign({}, branch[0], { config: Object.assign({}, branch[0].config, { isDefault: true }) })].concat(branch.slice(1)) : branch));
      }
      return Object.assign({}, node, { children });
    });
  return mark(nextGraph);
};

export const NodeTitle = ({ kind, title, issues, extra }) => {
  const { formatMessage } = useIntl();
  const hasError = issues?.some(issue => issue.level === 'error');
  return (
    <Flex gap={8} align="center" className={style['node-title']}>
      <NodeKindIcon kind={kind} />
      <span className={style['node-title-text']}>{typeof title === 'string' ? <span className={style['node-title-label']}>{title}</span> : title}</span>
      {issues?.length > 0 && (
        <Tooltip title={issues.map(issue => formatMessage({ id: `issue_${issue.code}` }, issue.params)).join('；')}>
          <ExclamationCircleFilled className={hasError ? style['node-title-error'] : style['node-title-warning']} />
        </Tooltip>
      )}
      {extra}
    </Flex>
  );
};

export const NodeCard = ({ summary, extra }) => {
  return (
    <Flex vertical gap={4} className={style['node-card']}>
      <span className={style['node-card-summary']}>{summary}</span>
      {extra}
    </Flex>
  );
};

const IssuePanel = ({ issues, graph, onLocate }) => {
  const { formatMessage } = useIntl();
  const errorCount = issues.filter(issue => issue.level === 'error').length;
  const warningCount = issues.length - errorCount;
  return (
    <div className={classnames(style['issue-panel'], { [style['is-error']]: errorCount > 0 })}>
      <Flex gap={8} align="center" justify="space-between" className={style['issue-panel-header']}>
        <span className={style['issue-panel-title']}>{formatMessage({ id: 'issuePanelTitle' })}</span>
        <Flex gap={6}>
          {errorCount > 0 && <span className={classnames(style['issue-count'], style['is-error'])}>{formatMessage({ id: 'issueCountError' }, { count: errorCount })}</span>}
          {warningCount > 0 && <span className={classnames(style['issue-count'], style['is-warning'])}>{formatMessage({ id: 'issueCountWarning' }, { count: warningCount })}</span>}
        </Flex>
      </Flex>
      <div className={style['issue-list']}>
        {issues.map((issue, index) => {
          const node = issue.nodeId ? findNodeById(graph, issue.nodeId) : null;
          const Icon = issue.level === 'error' ? CloseCircleFilled : ExclamationCircleFilled;
          return (
            <Flex
              key={index}
              gap={8}
              align="center"
              className={classnames(style['issue-item'], { [style['is-clickable']]: !!node })}
              onClick={() => node && onLocate(node.id)}
              role={node ? 'button' : undefined}
              tabIndex={node ? 0 : undefined}
              onKeyDown={e => node && (e.key === 'Enter' || e.key === ' ') && onLocate(node.id)}
            >
              <Icon className={issue.level === 'error' ? style['issue-icon-error'] : style['issue-icon-warning']} />
              {node?.title && <span className={style['issue-node']}>{node.title}</span>}
              <Text type="secondary" className={style['issue-message']}>
                {formatMessage({ id: `issue_${issue.code}` }, issue.params)}
              </Text>
              {node && <RightOutlined className={style['issue-arrow']} />}
            </Flex>
          );
        })}
      </div>
    </div>
  );
};

const ApprovalFlowDesigner = withLocale(props => {
  const { formatMessage } = useIntl();
  const { value, defaultValue, onChange, inputSchema, displaySchema, capabilities = DEFAULT_CAPABILITIES, pickers, renderModal, readonly = false, vertical = true, height = 640, showIssues = true, onIssuesChange, className } = props;
  const contextLabels = useContextLabels();
  const defaultGraph = useMemo(() => createDefaultGraph({ labels: { start: formatMessage({ id: 'nodeType_start' }), end: formatMessage({ id: 'nodeType_end' }) } }), [formatMessage]);
  const isControlled = value !== undefined;
  const [innerGraph, setInnerGraph] = useState(defaultValue);
  const current = isControlled ? value : innerGraph;
  const graph = Array.isArray(current) && current.length > 0 ? current : defaultGraph;
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const [editingId, setEditingId] = useState(null);

  const changeGraph = next => {
    const normalized = ensureDefaultBranch(graphRef.current, next);
    isControlled || setInnerGraph(normalized);
    onChange && onChange(normalized);
  };

  const contextSchema = useMemo(() => buildContextSchema(inputSchema, graph, { labels: contextLabels }), [inputSchema, graph, contextLabels]);
  const issues = useMemo(() => validateFlow(graph, { inputSchema }), [graph, inputSchema]);
  const issuesByNode = useMemo(() => {
    const map = {};
    issues.forEach(issue => {
      map[issue.nodeId] = (map[issue.nodeId] || []).concat([issue]);
    });
    return map;
  }, [issues]);
  const parentTypeMap = useMemo(() => getParentTypeMap(graph), [graph]);

  const onIssuesChangeRef = useRef(onIssuesChange);
  onIssuesChangeRef.current = onIssuesChange;
  useEffect(() => {
    onIssuesChangeRef.current && onIssuesChangeRef.current(issues);
  }, [issues]);

  const nodeTypeList = useMemo(() => {
    const toMenuItem = type => {
      const Icon = NODE_KIND_ICONS[type];
      return {
        type,
        name: formatMessage({ id: `nodeType_${type}` }),
        description: formatMessage({ id: `nodeTypeDesc_${type}` }),
        icon: <Icon />,
        className: getKindClassName(type)
      };
    };
    return [
      {
        name: formatMessage({ id: 'groupTask' }),
        list: [NODE_TYPES.APPROVAL, NODE_TYPES.HANDLE, NODE_TYPES.CC].map(toMenuItem)
      },
      {
        name: formatMessage({ id: 'groupBranch' }),
        list: [NODE_TYPES.CONDITION, NODE_TYPES.PARALLEL].map(toMenuItem)
      }
    ];
  }, [formatMessage]);

  const nodeTemplate = useMemo(() => {
    const taskTemplate = type => () => ({ title: formatMessage({ id: `nodeType_${type}` }), key: createNodeKey(type), config: createNodeConfig(type) });
    return {
      approval: taskTemplate(NODE_TYPES.APPROVAL),
      handle: taskTemplate(NODE_TYPES.HANDLE),
      cc: taskTemplate(NODE_TYPES.CC),
      condition: () => ({ title: formatMessage({ id: 'nodeType_condition' }), config: {} }),
      parallel: () => ({ title: formatMessage({ id: 'nodeType_parallel' }), content: formatMessage({ id: 'summaryJoin_all' }), config: createNodeConfig(NODE_TYPES.PARALLEL) }),
      branch: ({ parentType }) => ({
        title: formatMessage({ id: parentType === NODE_TYPES.PARALLEL ? 'nodeType_parallelBranchItem' : 'nodeType_conditionBranchItem' }),
        content: '',
        config: createNodeConfig(NODE_TYPES.BRANCH, { parentType })
      })
    };
  }, [formatMessage]);

  const editingNode = editingId ? findNodeById(graph, editingId) : null;

  return (
    <DesignerProvider value={{ graph, inputSchema, displaySchema, contextSchema, capabilities, pickers, renderModal, issues, readonly }}>
      <Flex vertical gap={8} className={classnames(style['designer'], className)}>
        <div className={style['designer-chart']} style={{ height }}>
          <ReactFlowChart
            value={graph}
            onChange={changeGraph}
            readonly={readonly}
            vertical={vertical}
            nodeTypeList={nodeTypeList}
            nodeTemplate={nodeTemplate}
            renderNodeTitle={({ nodeData, title }) => <NodeTitle kind={getNodeKind(nodeData, parentTypeMap[nodeData.id])} title={title} issues={issuesByNode[nodeData.id]} />}
            renderNodeContent={({ nodeData }) => <NodeCard summary={summarizeNode(nodeData, { formatMessage, parentType: parentTypeMap[nodeData.id] })} />}
            getNodeClassName={({ nodeData }) =>
              classnames(style['node'], getKindClassName(getNodeKind(nodeData, parentTypeMap[nodeData.id])), {
                [style['node-has-error']]: issuesByNode[nodeData.id]?.some(issue => issue.level === 'error')
              })
            }
            onEditNode={({ nodeData }) => setEditingId(nodeData.id)}
          />
        </div>
        {showIssues && issues.length > 0 && <IssuePanel issues={issues} graph={graph} onLocate={setEditingId} />}
        {editingNode && (
          <NodeConfigModal
            open
            node={editingNode}
            readonly={readonly}
            onCancel={() => setEditingId(null)}
            onSubmit={nextNode => {
              changeGraph(treeUtil.replaceNode(graphRef.current, { node: nextNode }));
              setEditingId(null);
            }}
          />
        )}
      </Flex>
    </DesignerProvider>
  );
});

export default ApprovalFlowDesigner;
