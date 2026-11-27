import classnames from 'classnames';
import { AuditOutlined, SolutionOutlined, SendOutlined, BranchesOutlined, ApartmentOutlined, FilterOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { NODE_TYPES } from './core/constants';
import style from './style.module.scss';

export const NODE_KIND_ICONS = {
  approval: AuditOutlined,
  handle: SolutionOutlined,
  cc: SendOutlined,
  condition: BranchesOutlined,
  parallel: ApartmentOutlined,
  conditionBranch: FilterOutlined,
  parallelBranch: NodeIndexOutlined
};

export const getNodeKind = (node, parentType) => {
  if (node.type === NODE_TYPES.BRANCH) {
    return parentType === NODE_TYPES.PARALLEL ? 'parallelBranch' : 'conditionBranch';
  }
  return node.type;
};

export const getKindClassName = kind => style[`kind-${kind}`];

export const NodeKindIcon = ({ kind, className }) => {
  const Icon = NODE_KIND_ICONS[kind];
  if (!Icon) {
    return null;
  }
  return (
    <span className={classnames(style['node-icon'], getKindClassName(kind), className)}>
      <Icon />
    </span>
  );
};
