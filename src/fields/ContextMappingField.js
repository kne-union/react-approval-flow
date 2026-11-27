import { Flex, Input, Select } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { AddButton, RemoveButton } from './ActionButtons';
import { hooks, useFormContext } from '@kne/react-form-antd';
import { useIntl } from '@kne/react-intl';
import { VARS_KEY_PATTERN } from '../core/constants';
import style from '../style.module.scss';

const { useOnChange } = hooks;

const stripVars = target => String(target || '').replace(/^vars\./, '');

export const ContextMappingEditor = ({ value, onChange, formFieldName = 'form' }) => {
  const { formatMessage } = useIntl();
  const { formData } = useFormContext() || {};
  const properties = formData?.[formFieldName]?.dataSchema?.properties || {};
  const fieldOptions = Object.keys(properties).map(name => ({ label: properties[name].title || name, value: name }));
  const list = Array.isArray(value) ? value : [];
  const setList = next => onChange && onChange(next);
  const updateAt = (index, patch) => setList(list.map((item, current) => (current === index ? Object.assign({}, item, patch) : item)));
  return (
    <Flex vertical gap={8}>
      {list.map((item, index) => {
        const key = stripVars(item.target);
        const invalid = key && !VARS_KEY_PATTERN.test(key);
        return (
          <Flex key={index} gap={8} align="center" wrap className={style['mapping-row']}>
            <Select
              style={{ flex: '1 1 160px', minWidth: 0 }}
              value={item.field}
              options={fieldOptions}
              placeholder={formatMessage({ id: 'mappingFieldPlaceholder' })}
              onChange={field => updateAt(index, { field, target: item.target || `vars.${field}` })}
            />
            <ArrowRightOutlined className={style['mapping-arrow']} />
            <Input
              style={{ flex: '1 1 200px', minWidth: 0 }}
              addonBefore="vars."
              status={invalid ? 'error' : undefined}
              value={key}
              placeholder={formatMessage({ id: 'mappingTargetPlaceholder' })}
              onChange={e => updateAt(index, { target: e.target.value ? `vars.${e.target.value}` : '' })}
            />
            <RemoveButton onClick={() => setList(list.filter((current, currentIndex) => currentIndex !== index))} />
          </Flex>
        );
      })}
      {fieldOptions.length === 0 ? (
        <div className={style['inline-empty']}>{formatMessage({ id: 'mappingNeedForm' })}</div>
      ) : (
        <AddButton onClick={() => setList(list.concat([{ field: undefined, target: '' }]))}>{formatMessage({ id: 'addMapping' })}</AddButton>
      )}
    </Flex>
  );
};

const ContextMappingField = props => {
  const render = useOnChange(props);
  return render(ContextMappingEditor);
};
ContextMappingField.field = ContextMappingEditor;

export default ContextMappingField;
