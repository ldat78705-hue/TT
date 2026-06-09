import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  required?: boolean;
}

// Sử dụng 'vi-VN' để định dạng dấu chấm phân cách hàng nghìn (ví dụ: 1.000.000)
const formatter = new Intl.NumberFormat('vi-VN');

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, className, required = false }) => {
  const [displayValue, setDisplayValue] = React.useState(typeof value === 'number' ? formatter.format(value) : '');
  
  // This effect syncs the display value when the prop `value` changes from outside,
  // for example, when opening an edit modal.
  React.useEffect(() => {
    const currentNumericValue = parseInt(displayValue.replace(/[^0-9]/g, ''), 10) || 0;
    if (value !== currentNumericValue) {
      setDisplayValue(typeof value === 'number' ? formatter.format(value) : '');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericString = rawValue.replace(/[^0-9]/g, '');

    if (numericString === '') {
      setDisplayValue('');
      onChange(0);
    } else {
      const numericValue = parseInt(numericString, 10);
      setDisplayValue(formatter.format(numericValue));
      onChange(numericValue);
    }
  };

  const handleBlur = () => {
    // When focus is lost, if the field is empty, format the underlying value (which is 0)
    // to ensure the display is consistent.
    if (displayValue === '') {
      setDisplayValue(formatter.format(0));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="0"
      className={className}
      required={required}
    />
  );
};