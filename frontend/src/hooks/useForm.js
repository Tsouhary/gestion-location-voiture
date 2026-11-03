import { useState } from 'react';

/** État de formulaire : `bind` pour input/select/textarea, `bindCheck` pour une case à cocher. */
export default function useForm(initial) {
  const [values, setValues] = useState(initial);
  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => set(name, e.target.value),
  });
  const bindCheck = (name) => ({
    name,
    checked: Boolean(values[name]),
    onChange: (e) => set(name, e.target.checked),
  });

  return { values, setValues, bind, bindCheck };
}
