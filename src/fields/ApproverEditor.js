import { Flex, InputNumber, Radio, Select, Switch, Typography } from 'antd';
import { hooks } from '@kne/react-form-antd';
import { useIntl } from '@kne/react-intl';
import { APPROVER_SOURCES } from '../core/constants';
import { useDesignerContext } from '../context';
import Picker from './Picker';
import { AddButton, RemoveButton } from './ActionButtons';
import style from '../style.module.scss';

const { useOnChange } = hooks;
const { Text } = Typography;

const PICKER_TYPE = { user: 'user', role: 'role', deptLeader: 'dept' };

export const getAvailableSources = capabilities => APPROVER_SOURCES.filter(item => !item.capability || (capabilities || []).indexOf(item.capability) > -1);

const createApprover = source => {
  switch (source) {
    case 'superior':
      return { source, level: 1, continuous: false };
    case 'deptLeader':
      return { source, scope: 'initiatorDept', items: [] };
    case 'formField':
      return { source, field: undefined };
    case 'initiatorSelect':
      return { source, multiple: true };
    case 'initiator':
      return { source };
    default:
      return { source, items: [] };
  }
};

const ApproverRow = ({ value, onChange, onRemove, sources, userFields }) => {
  const { formatMessage } = useIntl();
  const update = patch => onChange(Object.assign({}, value, patch));
  const renderDetail = () => {
    switch (value.source) {
      case 'user':
      case 'role':
        return <Picker type={PICKER_TYPE[value.source]} value={value.items} onChange={items => update({ items })} />;
      case 'deptLeader':
        return (
          <Flex vertical gap={8} flex={1}>
            <Radio.Group
              value={value.scope || 'initiatorDept'}
              onChange={e => update({ scope: e.target.value })}
              options={[
                { label: formatMessage({ id: 'deptScopeInitiator' }), value: 'initiatorDept' },
                { label: formatMessage({ id: 'deptScopeSpecified' }), value: 'specified' }
              ]}
            />
            {value.scope === 'specified' && <Picker type="dept" value={value.items} onChange={items => update({ items })} />}
          </Flex>
        );
      case 'superior':
        return (
          <Flex gap={8} align="center" wrap>
            <InputNumber min={1} max={10} value={value.level} onChange={level => update({ level })} addonBefore={formatMessage({ id: 'superiorLevel' })} />
            <Switch checked={!!value.continuous} onChange={continuous => update({ continuous })} />
            <Text type="secondary">{formatMessage({ id: 'superiorContinuous' })}</Text>
          </Flex>
        );
      case 'formField':
        return (
          <Select
            style={{ width: '100%' }}
            value={value.field}
            placeholder={formatMessage({ id: 'formFieldPlaceholder' })}
            options={(userFields || []).map(field => ({ label: field.label, value: field.path }))}
            onChange={field => update({ field })}
            notFoundContent={formatMessage({ id: 'formFieldEmpty' })}
          />
        );
      case 'initiatorSelect':
        return (
          <Flex gap={8} align="center">
            <Switch checked={value.multiple !== false} onChange={multiple => update({ multiple })} />
            <Text type="secondary">{formatMessage({ id: 'initiatorSelectMultiple' })}</Text>
          </Flex>
        );
      default:
        return <Text type="secondary">{formatMessage({ id: 'approverSource_initiatorTips' })}</Text>;
    }
  };
  return (
    <Flex vertical className={style['approver-row']} gap={8}>
      <Flex gap={8} align="center" justify="space-between">
        <Select
          className={style['approver-source']}
          style={{ width: 180 }}
          value={value.source}
          options={sources.map(item => ({ label: formatMessage({ id: `approverSource_${item.value}` }), value: item.value }))}
          onChange={source => onChange(createApprover(source))}
        />
        <RemoveButton onClick={onRemove} />
      </Flex>
      <div className={style['approver-detail']}>{renderDetail()}</div>
    </Flex>
  );
};

export const ApproverEditor = ({ value, onChange, userFields }) => {
  const { formatMessage } = useIntl();
  const { capabilities } = useDesignerContext();
  const sources = getAvailableSources(capabilities);
  const list = Array.isArray(value) ? value : [];
  const setList = next => onChange && onChange(next);
  return (
    <Flex vertical gap={8} className={style['approver-editor']}>
      {list.map((item, index) => (
        <ApproverRow
          key={index}
          value={item}
          sources={sources}
          userFields={userFields}
          onChange={next => setList(list.map((current, currentIndex) => (currentIndex === index ? next : current)))}
          onRemove={() => setList(list.filter((current, currentIndex) => currentIndex !== index))}
        />
      ))}
      <AddButton onClick={() => setList(list.concat([createApprover(sources[0]?.value || 'user')]))}>{formatMessage({ id: 'addApprover' })}</AddButton>
    </Flex>
  );
};

const ApproverField = props => {
  const render = useOnChange(props);
  return render(ApproverEditor);
};
ApproverField.field = ApproverEditor;

export default ApproverField;
