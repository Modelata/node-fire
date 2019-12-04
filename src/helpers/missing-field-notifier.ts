/**
 * Helper that indicates fields that are missing in model based on data sent to DB.
 */
export class MissingFieldNotifier {
  /**
   * Already notified fields that will not be displayed again (until next restart of application)
   */
  private static notifiedFields: { clazz: string; field: string }[] = [];

  /**
   * Display a warning in console about missing fields in model. Each field is notified only once.
   * 
   * @param clazz name of the targeted model
   * @param field name of the missing property
   */
  public static notifyMissingField(clazz: string, field: string): void {
    if (
      !MissingFieldNotifier.notifiedFields.find(
        notifiedField =>
          notifiedField.clazz === clazz && notifiedField.field === field
      )
    ) {
      console.warn(
        `property ${field} does not exist in class ${clazz} => consider to add it`
      );
      MissingFieldNotifier.notifiedFields.push({ clazz, field });
    }
  }
}
