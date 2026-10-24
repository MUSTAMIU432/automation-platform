import { useId, useState, type ReactNode } from 'react'

import { useFieldAppearance } from './fieldAppearance'
import {
  fieldErrorClasses,
  inputClasses,
  labelClasses,
  softInputClasses,
  softLabelClasses,
} from './fieldStyles'
import { EyeIcon, EyeOffIcon } from './icons'

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  error?: string
  disabled?: boolean
  placeholder?: string
  /** A decorative icon inside the field's start (soft appearance only). */
  icon?: ReactNode
  /** Keep the label for assistive technology but not on screen (see TextField). */
  hideLabel?: boolean
}

/** Password input with a show/hide toggle that preserves the entered value. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  disabled,
  placeholder,
  icon,
  hideLabel,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const errorId = useId()
  const soft = useFieldAppearance() === 'soft'
  const withIcon = soft && Boolean(icon)

  return (
    <div>
      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : soft ? softLabelClasses : labelClasses}
      >
        {label}
      </label>
      <div className="relative">
        {withIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-sage"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${
            soft
              ? softInputClasses(Boolean(error), { withIcon, withTrailing: true })
              : `${inputClasses(Boolean(error))} pr-11`
          } w-full`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className={`absolute inset-y-0 right-0 flex items-center justify-center ${soft ? 'w-12 text-sage' : 'w-10 text-gray-400'} hover:text-gray-600 focus:outline-none focus-visible:text-brand-600 disabled:cursor-not-allowed disabled:text-gray-300`}
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className={fieldErrorClasses}>
          {error}
        </p>
      )}
    </div>
  )
}
