import React from 'react';
export const Poster = ({ url, title }) => {
  return (
    <div className="text-center">
      <div className="w-full h-72 bg-gray-100 rounded-lg shadow-lg overflow-hidden flex items-center justify-center">
        {url ? (
          <img
            src={url}
            alt={title}
            className="object-cover w-full h-full"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '';
            }}
          />
        ) : (
          <span className="text-gray-400">No Image</span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500">{title}</p>
    </div>
  );
};
