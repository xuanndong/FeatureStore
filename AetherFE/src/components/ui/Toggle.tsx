import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      aria-checked={checked}
      role="switch"
    />
  );
};
