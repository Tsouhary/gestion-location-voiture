import useCountUp from '../hooks/useCountUp.js';
import { Icon } from './Icons.jsx';

/** Carte de chiffre clé, avec compteur animé. `format` transforme la valeur affichée (ex. montant). */
export default function Stat({ label, value, icon, tone = 'indigo', highlight, format }) {
  const shown = useCountUp(value);
  return (
    <div className={`stat tone-${tone}${highlight ? ' stat-highlight' : ''}`}>
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <div>
        <div className="stat-value">{format ? format(shown) : shown}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
