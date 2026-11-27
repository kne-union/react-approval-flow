import { BRANCH_CONTAINER_TYPES, NODE_TYPES } from './constants';

export const isBranchContainer = node => !!node && BRANCH_CONTAINER_TYPES.indexOf(node.type) > -1;

/**
 * 深度优先遍历流程图，visitor 收到 (node, { parent, branchIndex, path })
 * path 为从根到当前节点所在序列的容器链：[{ container, branchIndex }]
 */
export const walkGraph = (graph, visitor) => {
  const walkList = (list, path) => {
    (list || []).forEach(node => {
      visitor(node, { path });
      if (isBranchContainer(node)) {
        (node.children || []).forEach((branch, branchIndex) => {
          walkList(branch, path.concat([{ container: node, branchIndex }]));
        });
      }
    });
  };
  walkList(graph, []);
};

export const collectNodes = (graph, filter) => {
  const list = [];
  walkGraph(graph, node => {
    if (!filter || filter(node)) {
      list.push(node);
    }
  });
  return list;
};

export const findNodeById = (graph, id) => {
  let target = null;
  walkGraph(graph, node => {
    if (!target && node.id === id) {
      target = node;
    }
  });
  return target;
};

/** 找到节点所在的序列和下标；分支头 branch 节点所在序列为分支本身 */
const locateNode = (graph, id) => {
  let location = null;
  const walkList = (list, path) => {
    for (let index = 0; index < (list || []).length; index++) {
      const node = list[index];
      if (node.id === id) {
        location = { list, index, path };
        return true;
      }
      if (isBranchContainer(node)) {
        for (let branchIndex = 0; branchIndex < (node.children || []).length; branchIndex++) {
          if (walkList(node.children[branchIndex], path.concat([{ container: node, branchIndex, list, index }]))) {
            return true;
          }
        }
      }
    }
    return false;
  };
  walkList(graph, []);
  return location;
};

/** 汇聚规则为 all 的并行分支，所有分支内节点都一定会经过 */
const isGuaranteedContainer = node => node.type === NODE_TYPES.PARALLEL && (node.config?.joinRule || 'all') === 'all';

const collectGuaranteedInList = (list, endIndex, result) => {
  for (let index = 0; index < endIndex; index++) {
    const node = list[index];
    result.push(node);
    if (isGuaranteedContainer(node)) {
      (node.children || []).forEach(branch => collectGuaranteedInList(branch, branch.length, result));
    }
  }
};

/**
 * 计算某节点之前一定会经过的节点（用于限定条件可引用的字段）
 * 条件分支内的节点、汇聚规则不是 all 的并行分支内节点，都可能不经过，不计入
 */
export const getGuaranteedUpstreamNodes = (graph, id) => {
  const location = locateNode(graph, id);
  if (!location) {
    return [];
  }
  const result = [];
  location.path.forEach(({ list, index }) => {
    collectGuaranteedInList(list, index, result);
  });
  collectGuaranteedInList(location.list, location.index, result);
  return result.filter(node => node.id !== id);
};

/** 获取节点所在的分支容器（branch 节点返回其所属容器） */
export const getBranchContainer = (graph, id) => {
  const location = locateNode(graph, id);
  if (!location || location.path.length === 0) {
    return null;
  }
  return location.path[location.path.length - 1].container;
};

export const getNodeKey = node => node?.key || node?.id;
