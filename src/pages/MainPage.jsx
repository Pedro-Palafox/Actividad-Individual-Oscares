import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export const MainPage = () => {
  const movieOptions = [
    'Dune',
    'Everything Everywhere All at Once',
    'The Power of the Dog',
    'Parasite',
    'Roma',
  ];
  const animatedOptions = [
    'Spider-Man: Across the Spider-Verse',
    'Encanto',
    'Soul',
    'Toy Story 4',
    'Frozen II',
  ];
  const effectsOptions = [
    'Dune',
    'No Time to Die',
    'Godzilla vs. Kong',
    'Avengers: Endgame',
    '1917',
  ];
  const actorOptions = [
    'Timothée Chalamet',
    'Brad Pitt',
    'Will Smith',
    'Joaquin Phoenix',
    'Leonardo DiCaprio',
  ];

  const emptyForm = {
    name: '',
    pelicula: '',
    pelicula_animada: '',
    efectos: '',
    actor: '',
  };

  const [predictions, setPredictions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('predictions')
      .select('*')
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setPredictions(data);
      });
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };
  const openEdit = (p) => {
    setForm(p);
    setEditingId(p.id);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId == null) {
      const { data, error } = await supabase
        .from('predictions')
        .insert([{ ...form }])
        .select();
      if (error) console.error(error);
      else setPredictions((prev) => [...prev, data[0]]);
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .update({ ...form })
        .eq('id', editingId)
        .select();
      if (error) console.error(error);
      else
        setPredictions((prev) =>
          prev.map((p) => (p.id === editingId ? data[0] : p))
        );
    }
    closeModal();
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('predictions').delete().eq('id', id);
    if (error) console.error(error);
    else setPredictions((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-black">
        Predicciones de los Óscares
      </h1>

      <div className="text-center mb-8">
        <button
          onClick={openCreate}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
        >
          Hacer Predicciones
        </button>
      </div>

      <div className="max-w-6xl mx-auto overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow text-black">
          <thead>
            <tr className="bg-blue-100 text-center">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Mejor Película</th>
              <th className="px-4 py-3">Película Animada</th>
              <th className="px-4 py-3">Mejores Efectos</th>
              <th className="px-4 py-3">Mejor Actor</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {predictions.length === 0 && (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Aún no hay predicciones.
                </td>
              </tr>
            )}
            {predictions.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">{p.pelicula}</td>
                <td className="px-4 py-2">{p.pelicula_animada}</td>
                <td className="px-4 py-2">{p.efectos}</td>
                <td className="px-4 py-2">{p.actor}</td>
                <td className="px-4 py-2 space-x-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="px-3 py-1 bg-white border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1 bg-white border border-red-600 text-red-600 rounded hover:bg-red-50 transition"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg"
          >
            <h2 className="text-2xl font-semibold mb-4 text-black">
              {editingId ? 'Editar Predicción' : 'Nueva Predicción'}
            </h2>

            <label className="block text-gray-700">Tu Nombre</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            />

            <label className="block text-gray-700">Mejor Película</label>
            <select
              name="pelicula"
              value={form.pelicula}
              onChange={handleChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="" disabled>
                Selecciona una
              </option>
              {movieOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="block text-gray-700">Película Animada</label>
            <select
              name="pelicula_animada"
              value={form.pelicula_animada}
              onChange={handleChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="" disabled>
                Selecciona una
              </option>
              {animatedOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="block text-gray-700">Mejores Efectos</label>
            <select
              name="efectos"
              value={form.efectos}
              onChange={handleChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="" disabled>
                Selecciona una
              </option>
              {effectsOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="block text-gray-700">Mejor Actor</label>
            <select
              name="actor"
              value={form.actor}
              onChange={handleChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="" disabled>
                Selecciona una
              </option>
              {actorOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                {editingId ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
