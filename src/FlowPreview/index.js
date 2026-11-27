import { useMemo } from 'react';
import classnames from 'classnames';
import ReactFlowChart from '@kne/react-flow-chart';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import { summarizeNode } from '../summarize';
import { NodeCard, NodeTitle, getParentTypeMap } from '../ApprovalFlowDesigner';
import { getNodeKind, getKindClassName } from '../nodeKinds';
import style from '../style.module.scss';

/**
 * 只读流程图，叠加运行时状态
 * nodeStatus: { [nodeId]: { status, handlers: [{ label, status }], text } }
 */
const FlowPreview = withLocale(({ value, nodeStatus = {}, onNodeClick, vertical = true, height = 480, className }) => {
  const { formatMessage } = useIntl();
  const parentTypeMap = useMemo(() => getParentTypeMap(value || []), [value]);
  return (
    <div className={classnames(style['preview'], className)} style={{ height }}>
      <ReactFlowChart
        readonly
        value={value}
        vertical={vertical}
        renderNodeTitle={({ nodeData, title }) => {
          const status = nodeStatus[nodeData.id]?.status;
          return (
            <NodeTitle
              kind={getNodeKind(nodeData, parentTypeMap[nodeData.id])}
              title={title}
              extra={status ? <span className={classnames(style['status-pill'], style[`status-${status}`])}>{formatMessage({ id: `status_${status}` })}</span> : null}
            />
          );
        }}
        renderNodeContent={({ nodeData }) => {
          const current = nodeStatus[nodeData.id];
          return (
            <NodeCard
              summary={current?.text || summarizeNode(nodeData, { formatMessage, parentType: parentTypeMap[nodeData.id] })}
              extra={
                current?.handlers?.length ? (
                  <div className={style['preview-handlers']}>
                    {current.handlers.map((handler, index) => (
                      <span key={index} className={classnames(style['preview-handler'], style[`status-${handler.status || 'pending'}`])}>
                        {handler.label}
                      </span>
                    ))}
                  </div>
                ) : null
              }
            />
          );
        }}
        getNodeClassName={({ nodeData }) => {
          const status = nodeStatus[nodeData.id]?.status || 'pending';
          return classnames(style['node'], getKindClassName(getNodeKind(nodeData, parentTypeMap[nodeData.id])), style[`node-status-${status}`]);
        }}
        onEditNode={({ nodeData }) => onNodeClick && onNodeClick(nodeData, nodeStatus[nodeData.id])}
      />
    </div>
  );
});

export default FlowPreview;
