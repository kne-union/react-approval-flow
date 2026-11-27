import { useState } from 'react';
import { Button, Flex } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { FormModal } from '@kne/form-info';
import { hooks } from '@kne/react-form-antd';
import FormCreator, { schemaToDataSchema, collectSchemaFields, resolveLocaleText } from '@kne/form-creator';
import { useIntl } from '@kne/react-intl';
import { useDesignerContext } from '../context';
import style from '../style.module.scss';

const { useOnChange } = hooks;

/** 生成节点表单数据的 JSON Schema，并把字段标签补到 title 上，供条件编辑器展示 */
export const createFormDataSchema = (schema, { locale } = {}) => {
  if (!schema || !(schema.blocks || []).length) {
    return null;
  }
  const dataSchema = schemaToDataSchema(schema, { locale });
  const labels = {};
  collectSchemaFields(schema).forEach(field => {
    if (field?.name && labels[field.name] === undefined) {
      labels[field.name] = resolveLocaleText(field.label, locale) || field.name;
    }
  });
  Object.keys(dataSchema.properties || {}).forEach(name => {
    if (labels[name] && !dataSchema.properties[name].title) {
      dataSchema.properties[name] = Object.assign({}, dataSchema.properties[name], { title: labels[name] });
    }
  });
  return dataSchema;
};

export const NodeFormEditor = ({ value, onChange }) => {
  const { formatMessage, locale } = useIntl();
  const { renderModal } = useDesignerContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const current = value || {};
  const fieldNames = Object.keys(current.dataSchema?.properties || {});
  const modalProps = renderModal ? { renderModal } : {};
  const required = current.dataSchema?.required || [];
  return (
    <div className={style['form-summary']}>
      <Flex gap={8} align="center" justify="space-between" className={style['form-summary-header']}>
        <span className={style['form-summary-title']}>{fieldNames.length > 0 ? formatMessage({ id: 'nodeFormFieldCount' }, { count: fieldNames.length }) : formatMessage({ id: 'nodeFormEmpty' })}</span>
        <Button
          size="small"
          icon={fieldNames.length > 0 ? <EditOutlined /> : <PlusOutlined />}
          className={style['pill-btn']}
          onClick={() => {
            setDraft(current.schema || null);
            setOpen(true);
          }}
        >
          {formatMessage({ id: 'designNodeForm' })}
        </Button>
      </Flex>
      {fieldNames.length > 0 && (
        <div className={style['form-summary-fields']}>
          {fieldNames.map(name => (
            <span key={name} className={style['form-field-chip']}>
              {required.indexOf(name) > -1 && <span className={style['form-field-required']}>*</span>}
              {current.dataSchema.properties[name].title || name}
            </span>
          ))}
        </div>
      )}
      <FormModal
        {...modalProps}
        open={open}
        width={1100}
        destroyOnHidden
        title={formatMessage({ id: 'designNodeForm' })}
        onCancel={() => setOpen(false)}
        modalRender={({ defaultChildren }) => defaultChildren}
        footer={() => (
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setOpen(false)}>{formatMessage({ id: 'cancel' })}</Button>
            <Button
              type="primary"
              onClick={() => {
                onChange && onChange({ schema: draft, dataSchema: createFormDataSchema(draft, { locale }) });
                setOpen(false);
              }}
            >
              {formatMessage({ id: 'confirm' })}
            </Button>
          </Flex>
        )}
      >
        {open && <FormCreator value={draft || undefined} onChange={setDraft} {...modalProps} />}
      </FormModal>
    </div>
  );
};

const NodeFormField = props => {
  const render = useOnChange(props);
  return render(NodeFormEditor);
};
NodeFormField.field = NodeFormEditor;

export default NodeFormField;
