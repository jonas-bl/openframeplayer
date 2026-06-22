import type { MpvController } from './MpvController'
import type { MpvOperation } from './commandMap'

/**
 * Executes the operations produced by the command map against mpv, in order.
 *
 * Deliberately the only place that turns a pure {@link MpvOperation} into real
 * IPC, keeping the mapping logic (pure) and the side effects (here) cleanly
 * separated.
 */
export async function executeOperations(
  controller: MpvController,
  operations: MpvOperation[]
): Promise<void> {
  for (const op of operations) {
    if (op.kind === 'set') {
      await controller.setProperty(op.property, op.value)
    } else {
      await controller.command(op.args)
    }
  }
}
