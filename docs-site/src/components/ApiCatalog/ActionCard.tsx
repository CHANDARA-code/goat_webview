import React from 'react';
import { Tag, Button } from 'antd';
import { LockOutlined, ThunderboltOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { ApiAction } from '../../data/api-matrix';
import styles from './styles.module.css';

interface ActionCardProps {
  action: ApiAction;
  onSelect: (action: ApiAction) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onSelect }) => {
  return (
    <div className={styles.actionCard} onClick={() => onSelect(action)}>
      <div className={styles.cardHeader}>
        <Tag color="processing">{action.domain}</Tag>
        {action.permissions.scope !== 'none' ? (
          <Tag color="warning" icon={<LockOutlined />}>
            {action.permissions.scope}
          </Tag>
        ) : (
          <Tag color="success" icon={<ThunderboltOutlined />}>
            Zero-Perm
          </Tag>
        )}
      </div>

      <h3 className={styles.cardTitle}>
        <code>{action.action}</code>
      </h3>

      <p className={styles.cardDesc}>{action.description}</p>

      <div className={styles.cardFooter}>
        <div className={styles.platformIcons} style={{ display: 'flex', gap: 4 }}>
          <Tag color={action.platforms.android ? 'blue' : 'default'}>Android</Tag>
          <Tag color={action.platforms.ios ? 'geekblue' : 'default'}>iOS</Tag>
          <Tag color={action.platforms.reactNative ? 'cyan' : 'default'}>RN</Tag>
          <Tag color={action.platforms.flutter ? 'purple' : 'default'}>Flutter</Tag>
          <Tag color={action.platforms.web ? 'green' : 'default'}>Web</Tag>
        </div>

        <div className={styles.actionButtons}>
          <Button
            type="primary"
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(action);
            }}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
};
