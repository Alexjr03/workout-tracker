interface UpdatePromptProps {
  needRefresh: boolean;
  /** True during an active session: never interrupt a workout with a reload. */
  suppressed: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdatePrompt({ needRefresh, suppressed, onUpdate, onDismiss }: UpdatePromptProps) {
  if (!needRefresh || suppressed) return null;
  return (
    <div className="update-prompt" role="status">
      <span>Update ready</span>
      <button type="button" onClick={onDismiss}>
        Later
      </button>
      <button type="button" className="primary" onClick={onUpdate}>
        Update
      </button>
    </div>
  );
}
