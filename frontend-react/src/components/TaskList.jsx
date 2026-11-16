import TaskItem from './TaskItem'

export default function TaskList({ tasks, isFiltered = false, onUpdateTask, onDeleteTask }) {
  if (tasks.length === 0) {
    return (
      <p>{isFiltered ? 'No tasks match your filters.' : 'No tasks yet. Add one above.'}</p>
    )
  }

  return (
    <ul aria-label="Tasks">
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
