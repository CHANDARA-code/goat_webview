import React from 'react';
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
        <span className={styles.domainTag}>{action.domain}</span>
        {action.permissions.scope !== 'none' ? (
          <span className={styles.permissionTag}>🔒 {action.permissions.scope}</span>
        ) : (
          <span className={styles.zeroPermTag}>⚡ Zero-Perm</span>
        )}
      </div>

      <h3 className={styles.cardTitle}>
        <code>{action.action}</code>
      </h3>

      <p className={styles.cardDesc}>{action.description}</p>

      <div className={styles.cardFooter}>
        <div className={styles.platformIcons}>
          <span title="Android" className={action.platforms.android ? styles.platActive : styles.platDim}>🤖</span>
          <span title="iOS" className={action.platforms.ios ? styles.platActive : styles.platDim}>🍎</span>
          <span title="React Native" className={action.platforms.reactNative ? styles.platActive : styles.platDim}>⚛️</span>
          <span title="Flutter" className={action.platforms.flutter ? styles.platActive : styles.platDim}>🐦</span>
          <span title="Web Simulator" className={action.platforms.web ? styles.platActive : styles.platDim}>🌐</span>
        </div>

        <div className={styles.actionButtons}>
          <button
            className={styles.cardTryBtn}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(action);
            }}
          >
            Details & Simulator →
          </button>
        </div>
      </div>
    </div>
  );
};
