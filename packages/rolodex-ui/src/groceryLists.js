// Who else can see a shopping list, from the viewer's point of view.
export function sharingSummary(list) {
  if (!list.mine) {
    const owner = list.members.find((m) => m.id === list.ownerId)
    return `Shared by ${owner?.email ?? 'another user'}`
  }
  const others = list.members.length - 1
  return others === 0 ? 'Only you' : `Shared with ${others} ${others === 1 ? 'person' : 'people'}`
}
