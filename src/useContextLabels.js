import { useMemo } from 'react';
import { useIntl } from '@kne/react-intl';
import { DEFAULT_CONTEXT_LABELS } from './core/contextSchema';

const useContextLabels = () => {
  const { formatMessage } = useIntl();
  return useMemo(
    () =>
      Object.keys(DEFAULT_CONTEXT_LABELS).reduce((labels, key) => {
        labels[key] = formatMessage({ id: `context_${key}` });
        return labels;
      }, {}),
    [formatMessage]
  );
};

export default useContextLabels;
