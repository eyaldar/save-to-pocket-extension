import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullPage?: boolean;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  text, 
  fullPage = false 
}) => {
  const sizeClass = {
    sm: 'w-4 h-4 border-1',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2'
  }[size];

  const spinner = (
    <div className={`inline-flex items-center ${fullPage ? 'justify-center flex-col' : ''}`}>
      <div className={`spinner ${sizeClass}`} />
      {text && <span className="ml-2">{text}</span>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Spinner; 