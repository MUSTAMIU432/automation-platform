import type { InputHTMLAttributes, ReactNode } from 'react'

import { useFieldAppearance } from './fieldAppearance'
import {
  fieldErrorClasses,
  inputClasses,
  labelClasses,
  softInputClasses,
  softLabelClasses,
} from './fieldStyles'

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  autoComplete?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  /** A decorative icon inside the field's start (soft appearance only). */
  icon?: ReactNode
  /**
   * Keep the label for assistive technology but not on screen - only where
   * the icon and placeholder already say what the field is.
   */
  hideLabel?: boolean
}

/** A labeled text input with an accessible, field-adjacent error message. */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  error,
  disabled,
  icon,
  hideLabel,
}: TextFieldProps) {
  const errorId = `${id}-error`
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
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${
            soft ? softInputClasses(Boolean(error), { withIcon }) : inputClasses(Boolean(error))
          } w-full`}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className={fieldErrorClasses}>
          {error}
        </p>
      )}
    </div>
  )
}
