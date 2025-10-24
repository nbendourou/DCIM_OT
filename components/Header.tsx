
import React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <div className="pb-4 border-b border-slate-700">
      <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
    </div>
  );
};

export default Header;
