import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons.jsx';

/**
 * Liste déroulante à la Select2 : recherche intégrée, navigation clavier, liste affichée dans un portail
 * (donc jamais rognée par un modal). Remplace `<select>` sans changer les appels :
 * mêmes props (`value`, `onChange`, `name`, `required`, `disabled`) et des `<option>` en enfants.
 * `onChange` reçoit `{ target: { name, value } }`, comme l'événement d'un `<select>`.
 */

const SEARCH_MIN_OPTIONS = 5; // au-delà, la barre de recherche apparaît (inutile sur 2-3 choix)
const LIST_MAX = 240;
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const textOf = (node) =>
  Children.toArray(node)
    .map((c) => {
      if (typeof c === 'string' || typeof c === 'number') return String(c);
      return isValidElement(c) ? textOf(c.props.children) : '';
    })
    .join('');

function parseOptions(children, out = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) return parseOptions(c.props.children, out);
    if (c.type === 'option') {
      const label = textOf(c.props.children);
      out.push({ value: String(c.props.value ?? label), label, disabled: Boolean(c.props.disabled) });
    }
  });
  return out;
}

const sameBox = (a, b) => a && b && ['left', 'top', 'bottom', 'width', 'maxHeight'].every((k) => a[k] === b[k]);

export default function Select({
  value, onChange, name, required, disabled, children, placeholder = 'Sélectionner…', searchable, className = '',
}) {
  const options = parseOptions(children);
  const current = String(value ?? '');
  const selected = options.find((o) => o.value === current);
  const hasSearch = searchable ?? options.length > SEARCH_MIN_OPTIONS;

  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const shown = query ? options.filter((o) => norm(o.label).includes(norm(query))) : options;

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 300), window.innerWidth - 16);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    const next = {
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      maxHeight: Math.max(160, Math.min(up ? above : below, LIST_MAX + 64)),
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    };
    setBox((prev) => (sameBox(prev, next) ? prev : next));
  };

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const commit = (opt) => {
    if (!opt || opt.disabled) return;
    onChange?.({ target: { name, value: opt.value } });
    close(true);
  };

  // Focus dans la liste à l'ouverture ; fermeture au clic extérieur ; repositionnement au défilement / redimensionnement.
  useEffect(() => {
    if (!open) return undefined;
    (searchRef.current ?? listRef.current)?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = (e) => {
      if (!dropRef.current?.contains(e.target)) place();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // L'option active reste visible quand on navigue au clavier.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active, query]);

  // Un champ désactivé pendant que la liste est ouverte la referme.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < shown.length; i += dir) if (!shown[i].disabled) return i;
    return from;
  };

  const onListKey = (e) => {
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    switch (e.key) {
      case 'ArrowDown': stop(); setActive((a) => step(a, 1)); break;
      case 'ArrowUp': stop(); setActive((a) => step(a, -1)); break;
      case 'Home': stop(); setActive(step(-1, 1)); break;
      case 'End': stop(); setActive(step(shown.length, -1)); break;
      case 'Enter': stop(); commit(shown[active]); break;
      case 'Escape':
        stop();
        e.nativeEvent.stopPropagation(); // ne ferme pas le modal parent
        close(true);
        break;
      case 'Tab': stop(); close(true); break;
      default:
        // Sans champ de recherche : saisie rapide, comme un <select> natif.
        if (!hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key, at: now };
          const i = shown.findIndex((o) => !o.disabled && norm(o.label).startsWith(norm(typed.current.text)));
          if (i >= 0) setActive(i);
        }
    }
  };

  const onTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    }
  };

  const hasValue = selected && selected.value !== '';
  const label = selected ? selected.label : placeholder;

  return (
    <div className={`select2 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`select2-trigger${open ? ' is-open' : ''}${hasValue ? '' : ' is-placeholder'}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <span className="select2-value">{label}</span>
        <Icon name="chevronDown" size={16} className="select2-arrow" />
      </button>

      {/* Champ invisible : conserve la validation `required` native du navigateur. */}
      {required && (
        <input
          className="select2-required"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          required
          disabled={disabled}
          value={hasValue ? selected.value : ''}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
        />
      )}

      {open && box && createPortal(
        <div
          ref={dropRef}
          className={`select2-dropdown${box.bottom != null ? ' is-up' : ''}`}
          style={box}
          onKeyDown={onListKey}
        >
          {hasSearch && (
            <div className="select2-search">
              <Icon name="search" size={15} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Rechercher…"
                autoComplete="off"
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              />
            </div>
          )}
          <ul ref={listRef} id={listId} className="select2-list" role="listbox" tabIndex={-1}>
            {shown.length === 0 && <li className="select2-empty">Aucun résultat</li>}
            {shown.map((o, i) => (
              <li
                key={`${i}:${o.value}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                className={`select2-option${i === active ? ' is-active' : ''}${o.value === current ? ' is-selected' : ''}${o.disabled ? ' is-disabled' : ''}`}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(o)}
              >
                <span>{o.label}</span>
                {o.value === current && <Icon name="tick" size={15} />}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
