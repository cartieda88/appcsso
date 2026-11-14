/**
 * Tarea en segundo plano: cada ~30 min (el sistema decide el momento exacto)
 * sincroniza los pasos y avisa si se llegó a la meta, aunque la app esté cerrada.
 * Debe importarse en el nivel superior de la app (src/app/_layout.tsx).
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { auth } from './firebase';
import { syncTodaySteps } from './steps';

export const STEPS_TASK = 'muevete-sincronizar-pasos';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(STEPS_TASK, async () => {
    try {
      await auth.authStateReady();
      if (!auth.currentUser) return BackgroundTask.BackgroundTaskResult.Success;
      await syncTodaySteps();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function enableBackgroundSteps() {
  if (Platform.OS === 'web') return;
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (!(await TaskManager.isTaskRegisteredAsync(STEPS_TASK))) {
    await BackgroundTask.registerTaskAsync(STEPS_TASK, { minimumInterval: 30 });
  }
}
