import { Flex, Input, InputNumber, Radio, Select, Typography } from 'antd';
import { AddButton, RemoveButton } from '../fields/ActionButtons';
import classnames from 'classnames';
import { useIntl } from '@kne/react-intl';
import { OPERATORS, getOperatorsByField, createEmptyCondition, isConditionGroup } from '../core/condition';
import withLocale from '../withLocale';
import style from '../style.module.scss';

const { Text } = Typography;

const VALUE_STYLE = { flex: '1 1 180px', minWidth: 0 };

const getEnumOptions = field =>
  (field?.enum || []).map((item, index) => ({
    label: field.enumNames?.[index] || String(item),
    value: item
  }));

const ValueInput = ({ field, op, value, onChange }) => {
  const { formatMessage } = useIntl();
  const valueType = OPERATORS[op]?.valueType;
  if (!field || !op || valueType === 'none') {
    return null;
  }
  const isNumber = field.type === 'number' || field.type === 'integer';
  const enumOptions = getEnumOptions(field.type === 'array' ? field.items : field);
  if (field.type === 'boolean') {
    return (
      <Select
        style={VALUE_STYLE}
        value={value}
        onChange={onChange}
        options={[
          { label: formatMessage({ id: 'booleanTrue' }), value: true },
          { label: formatMessage({ id: 'booleanFalse' }), value: false }
        ]}
      />
    );
  }
  if (valueType === 'range') {
    const [min, max] = Array.isArray(value) ? value : [];
    return (
      <Flex gap={4} align="center" style={VALUE_STYLE}>
        <InputNumber value={min} onChange={next => onChange([next, max])} placeholder={formatMessage({ id: 'rangeMin' })} />
        <Text type="secondary">~</Text>
        <InputNumber value={max} onChange={next => onChange([min, next])} placeholder={formatMessage({ id: 'rangeMax' })} />
      </Flex>
    );
  }
  if (valueType === 'multiple') {
    return (
      <Select
        style={VALUE_STYLE}
        mode={enumOptions.length ? 'multiple' : 'tags'}
        value={Array.isArray(value) ? value : []}
        onChange={next => onChange(isNumber ? next.map(item => (isNaN(Number(item)) ? item : Number(item))) : next)}
        options={enumOptions}
        placeholder={formatMessage({ id: 'conditionValuePlaceholder' })}
      />
    );
  }
  if (enumOptions.length) {
    return <Select style={VALUE_STYLE} value={value} onChange={onChange} options={enumOptions} placeholder={formatMessage({ id: 'conditionValuePlaceholder' })} />;
  }
  if (isNumber) {
    return <InputNumber style={VALUE_STYLE} value={value} onChange={onChange} placeholder={formatMessage({ id: 'conditionValuePlaceholder' })} />;
  }
  return <Input style={VALUE_STYLE} value={value} onChange={e => onChange(e.target.value)} placeholder={formatMessage({ id: 'conditionValuePlaceholder' })} />;
};

const RuleRow = ({ value, onChange, onRemove, fields }) => {
  const { formatMessage } = useIntl();
  const field = fields.find(item => item.path === value.field);
  const operators = getOperatorsByField(field);
  const missing = value.field && !field;
  return (
    <Flex gap={8} align="center" wrap className={style['condition-rule']}>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ flex: '1 1 200px', minWidth: 0 }}
        status={missing ? 'error' : undefined}
        value={value.field}
        placeholder={formatMessage({ id: 'conditionFieldPlaceholder' })}
        options={fields.map(item => ({ label: item.label || item.path, value: item.path, title: item.path }))}
        onChange={path => {
          const nextField = fields.find(item => item.path === path);
          onChange({ field: path, op: getOperatorsByField(nextField)[0], value: undefined });
        }}
      />
      <Select
        style={{ flex: '0 0 116px' }}
        value={value.op}
        options={operators.map(op => ({ label: formatMessage({ id: `operator_${op}` }), value: op }))}
        onChange={op => onChange(Object.assign({}, value, { op, value: OPERATORS[op]?.valueType === OPERATORS[value.op]?.valueType ? value.value : undefined }))}
      />
      <ValueInput field={field} op={value.op} value={value.value} onChange={next => onChange(Object.assign({}, value, { value: next }))} />
      <RemoveButton onClick={onRemove} />
      {missing && (
        <Text type="danger" className={style['condition-rule-error']}>
          {formatMessage({ id: 'conditionFieldMissing' }, { field: value.field })}
        </Text>
      )}
    </Flex>
  );
};

const ConditionGroup = ({ value, onChange, onRemove, fields, depth, maxDepth }) => {
  const { formatMessage } = useIntl();
  const group = isConditionGroup(value) ? value : createEmptyCondition();
  const rules = group.rules;
  const setRules = next => onChange(Object.assign({}, group, { rules: next }));
  const updateAt = (index, next) => setRules(rules.map((rule, current) => (current === index ? next : rule)));
  const removeAt = index => setRules(rules.filter((rule, current) => current !== index));
  return (
    <div className={classnames(style['condition-group'], { [style['is-nested']]: depth > 1 })}>
      <Flex gap={8} align="center" justify="space-between" className={style['condition-group-header']}>
        <Flex gap={8} align="center" className={style['logic-switch']}>
          <span className={style['logic-switch-text']}>{formatMessage({ id: 'logicPrefix' })}</span>
          <Radio.Group
            size="small"
            optionType="button"
            className={style['logic-switch-group']}
            value={group.logic || 'and'}
            onChange={e => onChange(Object.assign({}, group, { logic: e.target.value }))}
            options={[
              { label: formatMessage({ id: 'logicAll' }), value: 'and' },
              { label: formatMessage({ id: 'logicAny' }), value: 'or' }
            ]}
          />
          <span className={style['logic-switch-text']}>{formatMessage({ id: 'logicSuffix' })}</span>
        </Flex>
        {onRemove && <RemoveButton title={formatMessage({ id: 'removeGroup' })} onClick={onRemove} />}
      </Flex>
      <Flex vertical gap={8}>
        {rules.length === 0 && <div className={style['inline-empty']}>{formatMessage({ id: 'conditionEmpty' })}</div>}
        {rules.map((rule, index) =>
          isConditionGroup(rule) ? (
            <ConditionGroup key={index} value={rule} fields={fields} depth={depth + 1} maxDepth={maxDepth} onChange={next => updateAt(index, next)} onRemove={() => removeAt(index)} />
          ) : (
            <RuleRow key={index} value={rule} fields={fields} onChange={next => updateAt(index, next)} onRemove={() => removeAt(index)} />
          )
        )}
      </Flex>
      <Flex gap={8} className={style['condition-group-actions']}>
        <AddButton inline onClick={() => setRules(rules.concat([{ field: undefined, op: undefined, value: undefined }]))}>
          {formatMessage({ id: 'addRule' })}
        </AddButton>
        {depth < maxDepth && (
          <AddButton inline onClick={() => setRules(rules.concat([createEmptyCondition()]))}>
            {formatMessage({ id: 'addGroup' })}
          </AddButton>
        )}
      </Flex>
    </div>
  );
};

/**
 * 结构化条件编辑器
 * fields: [{ path, label, type, enum, enumNames }]，通常来自 getAvailableContextFields(contextSchema, scope)
 */
const ConditionEditor = withLocale(({ value, onChange, fields = [], maxDepth = 2 }) => {
  return <ConditionGroup value={value} onChange={next => onChange && onChange(next)} fields={fields} depth={1} maxDepth={maxDepth} />;
});

export default ConditionEditor;
