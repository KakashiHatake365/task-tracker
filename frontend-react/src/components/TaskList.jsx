import TaskItem from './TaskItem'

export default function TaskList({ tasks, isFiltered = false, onUpdateTask, onDeleteTask }) {
  if (tasks.length === 0) {
    return (
      <p className="empty-state">{isFiltered ? 'No tasks match your filters.' : 'No tasks yet. Add your first task to get started.'}</p>
    )
  }

  return (
    <ul className="task-list" aria-label="Tasks">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </ul>
  )
}
