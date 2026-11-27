import { Button, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import { useIntl } from '@kne/react-intl';
import style from '../style.module.scss';

export const RemoveButton = ({ onClick, title, className }) => {
  const { formatMessage } = useIntl();
  const label = title || formatMessage({ id: 'remove' });
  return (
    <Tooltip title={label}>
      <Button type="text" danger aria-label={label} icon={<DeleteOutlined />} className={classnames(style['icon-btn'], className)} onClick={onClick} />
    </Tooltip>
  );
};

export const AddButton = ({ onClick, children, inline }) => (
  <Button type={inline ? 'text' : 'dashed'} block={!inline} icon={<PlusOutlined />} className={inline ? style['add-inline-btn'] : style['add-btn']} onClick={onClick}>
    {children}
  </Button>
);
