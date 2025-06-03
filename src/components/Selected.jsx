import React from 'react';

export const Selected = ({ label, name, value, onChange, options }) => {
  return (
    <div className="mb-4">
      <label className="block text-gray-700">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required
        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
      >
        <option value="" disabled>
          Selecciona una
        </option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.titulo}>
            {opt.titulo}
          </option>
        ))}
      </select>
    </div>
  );
};
