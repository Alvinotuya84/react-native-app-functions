import { defineAppFunctions } from 'react-native-app-functions/config';

export default defineAppFunctions({
  android: {
    kotlinPackage: 'io.github.alvinotuya.appfunctions.example.appfunctions',
    serviceName: 'FieldAppFunctionService',
    appDescription:
      "Field-agent app holding the agent's scheduled field records on this device. Use 'listTodaysRecords' to see what is scheduled today. All functions are read-only.",
    appDisplayDescription: "Lets assistants read today's field records",
  },
  types: {
    FieldRecord: {
      description: 'A field record scheduled for the current day.',
      fields: {
        id: {
          type: 'string',
          description: 'The unique identifier of the record.',
        },
        title: {
          type: 'string',
          description:
            'A short human-readable title describing the visit or task.',
        },
        status: {
          type: 'string',
          description:
            'The record status, one of "PENDING", "IN_PROGRESS" or "DONE".',
        },
        scheduledAt: {
          type: 'localDateTime',
          nullable: true,
          description:
            'The local date and time the record is scheduled for, or null if unscheduled.',
        },
      },
    },
  },
  functions: {
    listTodaysRecords: {
      description:
        'Lists the field records scheduled for today on this device, ordered by scheduled time.\nRead-only: does not modify any record.',
      handler: 'native',
      returns: {
        type: 'list',
        of: 'FieldRecord',
        description:
          "Today's field records. Empty if nothing is scheduled today.",
      },
    },
  },
});
