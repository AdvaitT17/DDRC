formatActionType(type) {
  const formats = {
    approve: "Approved",
    rejected: "Rejected",
    undo: "Undone",
    review: "Under Review",
    add_user: "User Added",
    toggle_user: "Status Changed",
  };
  return formats[type] || type;
}

formatDetails(log) {
  if (["approve", "rejected", "undo"].includes(log.action_type)) {
    return `Changed status from ${log.previous_status} to ${log.new_status}`;
  }
  if (log.action_type === "add_user") {
    return "Created new department user";
  }
  if (log.action_type === "toggle_user") {
    return `Changed user status from ${log.previous_status} to ${log.new_status}`;
  }
  if (log.action_type === "review") {
    return "Started reviewing application";
  }
  return "-";
} 