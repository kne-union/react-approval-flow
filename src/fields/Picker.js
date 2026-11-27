import { useEffect, useRef, useState } from 'react';
import { Select, Spin } from 'antd';
import { useIntl } from '@kne/react-intl';
import { useDesignerContext } from '../context';

/**
 * 选人 / 选角色 / 选部门
 * value 为 [{ value, label }]；pickers[type].render 可完全替换，pickers[type].loadOptions 提供远程搜索
 */
const Picker = ({ type, value, onChange, multiple = true, placeholder }) => {
  const { formatMessage } = useIntl();
  const { pickers } = useDesignerContext();
  const picker = pickers?.[type] || {};
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const requestId = useRef(0);
  const loadOptionsRef = useRef(picker.loadOptions);
  loadOptionsRef.current = picker.loadOptions;

  const search = keyword => {
    if (!loadOptionsRef.current) {
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const current = ++requestId.current;
      setLoading(true);
      try {
        const list = await loadOptionsRef.current(keyword || '');
        current === requestId.current && setOptions(list || []);
      } finally {
        current === requestId.current && setLoading(false);
      }
    }, 300);
  };

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (typeof picker.render === 'function') {
    return picker.render({ value: value || [], onChange, multiple, type });
  }

  const list = value || [];
  return (
    <Select
      mode={picker.loadOptions ? (multiple ? 'multiple' : undefined) : 'tags'}
      labelInValue
      showSearch
      filterOption={picker.loadOptions ? false : undefined}
      onSearch={picker.loadOptions ? search : undefined}
      notFoundContent={loading ? <Spin size="small" /> : undefined}
      placeholder={placeholder || formatMessage({ id: `pickerPlaceholder_${type}` })}
      options={options}
      value={multiple || !picker.loadOptions ? list : list[0]}
      onChange={next => {
        const items = (Array.isArray(next) ? next : next ? [next] : []).map(item => ({ value: item.value, label: typeof item.label === 'string' ? item.label : String(item.value) }));
        onChange && onChange(items);
      }}
      style={{ width: '100%' }}
    />
  );
};

export default Picker;
