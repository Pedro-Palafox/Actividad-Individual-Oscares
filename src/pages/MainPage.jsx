import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Poster } from '../components/Poster';
import { Selected } from '../components/Selected';

export const MainPage = () => {
  // Configuración de categorías: cada objeto tiene una clave 'id' (para buscar en datos/form) y un texto 'label' para mostrar en la interfaz.
  const categories = [
    { id: 'pelicula', label: 'Mejor Película' },
    { id: 'pelicula_animada', label: 'Película Animada' },
    { id: 'efectos', label: 'Mejores Efectos' },
    { id: 'actor', label: 'Mejor Actor' }
  ];

  const [nominees, setNominees] = useState([]); //  todos los nominados traídos de SupaBase
  const [predictions, setPredictions] = useState([]); // todas las predicciones hechas
  const [currentIndex, setCurrentIndex] = useState(0); // Índice compartido para mostrar cada póster 
  const [form, setForm] = useState({    
    name: '',
    pelicula: '',
    pelicula_animada: '',
    efectos: '',
    actor: ''
  });
  const [editingId, setEditingId] = useState(null); // Si editingId es null => crear nueva; si tiene un número => editar esa predicción
  const [modalOpen, setModalOpen] = useState(false);

  // Cargar datos al montar el componente
  useEffect(() => {
    const loadData = async () => {
      try {
        // Traer todos los nominados
        const { data: nomineesData } = await supabase.from('nominees').select('*');
        // Traer todas las predicciones
        const { data: predictionsData } = await supabase.from('predictions').select('*');
        
        // Si no hay resultados, usar array vacío
        setNominees(nomineesData || []);
        setPredictions(predictionsData || []);
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
    };
    
    loadData();
  }, []); // usamos [] para que solo se ejecuta una vez al montar

  // Agrupar nominados por categoría. Cada propiedad filtra por su campo 'categoria'.
  const groupedNominees = {
    pelicula: nominees.filter(n => n.categoria === 'pelicula'),
    pelicula_animada: nominees.filter(n => n.categoria === 'pelicula_animada'),
    efectos: nominees.filter(n => n.categoria === 'efectos'),
    actor: nominees.filter(n => n.categoria === 'actor')
  };

  // Ir al póster anterior si no estamos en el índice 0
  const showPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Ir al póster siguiente, calculando primero el largo máximo entre las categorías
  const showNext = () => {
    let maxItems = 0;
    // Recorremos cada categoría para hallar cuántos elementos tiene
    categories.forEach(cat => {
      const categoryItems = groupedNominees[cat.id].length;
      if (categoryItems > maxItems) {
        maxItems = categoryItems;
      }
    });
    // Solo incrementamos si no excedemos el tamaño de la lista más larga
    if (currentIndex < maxItems - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Actualiza el estado del formulario al cambiar un campo
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Enviar formulario ya sea crear o actualizar la predicción en SupaBase
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Para actualizar registro existente
        const { data } = await supabase
          .from('predictions')
          .update(form)
          .eq('id', editingId)
          .select();
        // Reemplazamos esa predicción en el estado local
        setPredictions(predictions.map(p => p.id === editingId ? data[0] : p));
      } else {
        // Para insertar un nuevo registro
        const { data } = await supabase
          .from('predictions')
          .insert([form])
          .select();
        setPredictions([...predictions, data[0]]);
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Error guardando predicción:', error);
    }
  };

  // Abre el modal; si pasamos una predicción, cargamos sus valores para editar
  const openForm = (prediction = null) => {
    setForm(prediction || {
      name: '',
      pelicula: '',
      pelicula_animada: '',
      efectos: '',
      actor: ''
    });
    // Usamos el "prediction?.id" para evitar error si prediction es null o undefined
    setEditingId(prediction?.id || null);
    setModalOpen(true);
  };

  // Eliminar predicción según su id
  const deletePrediction = async (id) => {
    try {
      await supabase.from('predictions').delete().eq('id', id);
      setPredictions(predictions.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error eliminando predicción:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-6 text-black">
        Predicciones de los Óscares
      </h1>

      {/* Grid de pósters con un contenedor de 4 columnas */}
      <div className="max-w-6xl mx-auto grid grid-cols-4 gap-6 mb-4">
        {categories.map(cat => {
          const categoryNominees = groupedNominees[cat.id] || []; // Tomar arreglo de nominados para esta categoría; si no existe, usar []
          const nominee = categoryNominees[currentIndex] || null; // Tomar el elemento en currentIndex; si no existe, null
          
          return (
            <div key={cat.id} className="text-center">
              <h1 className="text-lg font-semibold mb-2 text-gray-700">{cat.label}</h1>
              {nominee ? (
                // Si hay datos, mostrar componente Poster
                <Poster url={nominee.imagen_url} title={nominee.titulo} />
              ) : (
                // Placeholder gris si no hay imagen en esa posición
                <div className="w-full h-48 bg-gray-100 rounded-lg shadow-lg" />
              )}
            </div>
          );
        })}
      </div>

      {/* Controles de navegación */}
      <div className="max-w-6xl mx-auto flex justify-end space-x-2 mb-10">
        <button
          onClick={showPrevious}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="white" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={showNext}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="white" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Botón para abrir modal de nueva predicción */}
      <div className="text-center mb-8">
        <button
          onClick={() => openForm()}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
        >
          Hacer Predicciones
        </button>
      </div>

      {/* Tabla de predicciones */}
      <div className="max-w-6xl mx-auto overflow-x-auto">
        <table className="w-full bg-white rounded-lg shadow text-black">
          <thead>
            <tr className="bg-blue-100 text-center">
              <th className="px-4 py-3">Nombre</th>
              {/* Columnas dinámicas según categorías */}
              {categories.map(cat => (
                <th key={cat.id} className="px-4 py-3">{cat.label}</th>
              ))}
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {predictions.length === 0 ? (
              <tr>
                {/* colSpan = número de categorías + “Nombre” + “Acciones” */}
                <td colSpan={categories.length + 2} className="px-4 py-6 text-center text-gray-500">
                  Aún no hay predicciones.
                </td>
              </tr>
            ) : (
              predictions.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{p.name}</td>
                  {categories.map(cat => (
                    <td key={`${p.id}-${cat.id}`} className="px-4 py-2">{p[cat.id]}</td> // p[cat.id] accede dinámicamente a p.pelicula, p.actor, etc.
                  ))}
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => openForm(p)}
                      className="px-3 py-1 bg-white border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deletePrediction(p.id)}
                      className="px-3 py-1 bg-white border border-red-600 text-red-600 rounded hover:bg-red-50 transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de creación/edición */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <form onSubmit={handleSubmit} className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-black">
              {editingId ? 'Editar Predicción' : 'Nueva Predicción'}
            </h2>

            <label className="block text-gray-700">Tu Nombre</label>
            <input
              name="name"
              value={form.name}
              onChange={handleInputChange}
              required
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:border-blue-300"
            />

            {/* Un campo <Selected> por cada categoría */}
            {categories.map(cat => (
              <Selected
                key={cat.id}
                label={cat.label}
                name={cat.id}
                value={form[cat.id]}
                onChange={handleInputChange}
                options={groupedNominees[cat.id]} // Lista de nominados filtrados por categoría
              />
            ))}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-gray-900 rounded hover:bg-gray-400"
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
