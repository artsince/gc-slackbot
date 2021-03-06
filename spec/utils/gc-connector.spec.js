'use strict';

import nock from 'nock';
import graphCommonsConnector from '../../utils/gc-connector';
import memStorage from '../../utils/mem-storage';

describe('testing gc-connector', () => {

  describe('testing initial data load', () => {
    it ('should parse the channel membership data from Graph Commons', (done) => {
      const storage = memStorage();
      const gcConnector = graphCommonsConnector({
        storage: storage
      });

      const initialData = {
        nodes: [
          {
            id: '1',
            name: 'first user',
            type: 'User',
            type_id: '1',
            properties: {
              user_id: 'U1'
            }
          },
          {
            id: '2',
            name: 'first channel',
            type: 'Channel',
            type_id: '2',
            properties: {
              channel_id: 'C1'
            }
          },
          {
            id: '3',
            name: 'second channel',
            type: 'Channel',
            type_id: '2',
            properties: {
              channel_id: 'C2'
            }
          }
        ],
        edges: [
          {
            id: '4',
            name: 'MEMBER_OF',
            name_id: '5',
            from: '1',
            to: '2'
          },
          {
            id: '5',
            name: 'MEMBER_OF',
            name_id: '5',
            from: '1',
            to: '3'
          }
        ]
      };

      const checker = function() {
        expect(storage.users.getSync('U1').channels).toEqual(['C1', 'C2'])
        done();
      };

      gcConnector.loadInitialData(initialData).then(checker)
    });
  });

  describe('test synchronizing data', () => {

    describe('testing user synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          users: {
            'U1': {
              id: 'U1',
              name: 'first user',
              gc_id: '1'
            }
          }
        });

        const graphCache = {
          users: {
            '1': 'U1'
          },
          channels: {},
          edges: {
            'MEMBER_OF': {}
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it('should return node_create signals for each new Users', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'node_create',
            type: 'User',
            name: 'second user',
            image: 'img_u2.jpg',
            properties: {
              user_id: 'U2'
            }
          });
          done();
        };

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          },
          {
            id: 'U2',
            name: 'second user',
            profile: {
              image_192: 'img_u2.jpg'
            }
          }
        ];

        const newChannels = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it('should not return any node_create signals if there are no new Users', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(0);
          done();
        };

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        const newChannels = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

    });

    describe('testing channel synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '1'
            }
          }
        });

        const graphCache = {
          users: {},
          channels: {
            'C1': '1'
          },
          edges: {
            'MEMBER_OF': {}
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it('should return node_create signals for each new Channels', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'node_create',
            type: 'Channel',
            name: 'second channel',
            properties: {
              channel_id: 'C2'
            }
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should not return any node_create signal if there are no new Channels', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(0);
          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });
    });

    describe('testing membership synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '2'
            },
            'C2': {
              id: 'C2',
              name: 'second channel',
              gc_id: '3'
            }
          },
          users: {
            'U1': {
              id: 'U1',
              name: 'first user',
              gc_id: '1',
              channels: ['C1']
            }
          }
        });

        const graphCache = {
          users: {
            'U1': '1'
          },
          channels: {
            'C1': '2',
            'C2': '3'
          },
          edges: {
            'MEMBER_OF': {
              '1-2': '4'
            }
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it ('should return edge_create signal if a new channel membership exists', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'edge_create',
            name: 'MEMBER_OF',
            from_type: 'User',
            from_name: 'first user',
            to_type: 'Channel',
            to_name: 'second channel',
            properties: {}
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: [
              'U1'
            ]
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: [
              'U1'
            ]
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should return edge_delete signal if a channel membership no longer exists', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'edge_delete',
            name: 'MEMBER_OF',
            id: '4',
            from: '1',
            to: '2'
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should not return any signals if channel membership data is the same', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(0);
          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: ['U1']
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });
    });
  });

  describe('test channel join', () => {
    let storage;
    let mockScheduler;

    beforeEach(() => {

      mockScheduler = {
        addJob: jasmine.createSpy('addJob')
      };

      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            gc_id: '1'
          }
        },
        channels: {
          'C1': {
            id: 'C1',
            name: 'first channel',
            gc_id: '2'
          }
        }
      });

      const graphCache = {
        users: {
          '1': 'U1'
        },
        channels: {
          '2': 'C1'
        },
        edges: {
          'MEMBER_OF': {}
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: function() {
          return mockScheduler;
        }
      });

      gcConnector.onUserJoinedChannel({
        user: 'U1',
        channel: 'C1'
      });
    });

    it('should add channel id to member channels', (done) => {
      expect(storage.users.getSync('U1').channels).toEqual(['C1']);
      done();
    });

    it('should create edge_create signal from user to channel', (done) => {
      expect(mockScheduler.addJob).toHaveBeenCalledWith({
        action: 'edge_create',
        name: 'MEMBER_OF',
        from_type: 'User',
        from_name: 'first user',
        to_type: 'Channel',
        to_name: 'first channel'
      });
      done();
    });
  });

  describe('test channel leave', () => {
    let storage;
    let mockScheduler;
    let graphCache;

    beforeEach(() => {

      mockScheduler = {
        addJob: jasmine.createSpy('addJob')
      };

      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            gc_id: '1',
            channels: [
              'C1'
            ]
          }
        },
        channels: {
          'C1': {
            id: 'C1',
            name: 'first channel',
            gc_id: '2'
          }
        }
      });

      graphCache = {
        users: {
          '1': 'U1'
        },
        channels: {
          '2': 'C1'
        },
        edges: {
          'MEMBER_OF': {
            '1-2': '4'
          }
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: function() {
          return mockScheduler;
        }
      });

      gcConnector.onUserLeftChannel({
        user: 'U1',
        channel: 'C1'
      });
    });

    it('should remove channel id from member channels', (done) => {
      expect(storage.users.getSync('U1').channels).toEqual([]);
      done();
    });

    it('should create edge_delete signal from user to channel', (done) => {
      expect(mockScheduler.addJob).toHaveBeenCalledWith({
        action: 'edge_delete',
        name: 'MEMBER_OF',
        id: '4',
        from: '1',
        to: '2'
      });
      done();
    });
  });

  describe('test Graph Commons callback', () => {

    let storage;
    let mockScheduler;
    let graphCache;

    beforeEach(() => {
      mockScheduler = jasmine.createSpy('mockScheduler');
    });

    it('should map Graph Commons id to Slack channel id on node_create', () => {
      storage = memStorage({
        users: {
          'C1': {
            id: 'C1',
            name: 'first channel'
          }
        },
        channels: {}
      });

      graphCache = {
        users: {},
        channels: {},
        edges: {
          'MEMBER_OF': {}
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: mockScheduler
      });

      const jobDoneCallback = mockScheduler.calls.argsFor(0)[0].jobDone;

      jobDoneCallback({
        graph: {
          signals: [
            {
              action: 'node_create',
              id: '1',
              name: 'first channel',
              type: 'Channel',
              type_id: '2',
              properties: {
                channel_id: 'C1'
              }
            }
          ]
        }
      });

      expect(storage.channels.getSync('C1').gc_id).toEqual('1');
      expect(graphCache.channels['1']).toBeDefined();
      expect(graphCache.channels['1']).toEqual('C1');
    });

    it('should map Graph Commons id to Slack user id on node_create', () => {
      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            channels: []
          }
        },
        channels: {}
      });

      graphCache = {
        users: {},
        channels: {},
        edges: {
          'MEMBER_OF': {}
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: mockScheduler
      });

      const jobDoneCallback = mockScheduler.calls.argsFor(0)[0].jobDone;

      jobDoneCallback({
        graph: {
          signals: [
            {
              action: 'node_create',
              id: '1',
              name: 'first user',
              type: 'User',
              type_id: '2',
              properties: {
                user_id: 'U1'
              }
            }
          ]
        }
      });

      expect(storage.users.getSync('U1').gc_id).toEqual('1');
      expect(graphCache.users['1']).toBeDefined();
      expect(graphCache.users['1']).toEqual('U1');
    });

    it('should store Graph Commons edge for User Channel membership on edge_create', () => {
        storage = memStorage({
          users: {
            'U1': {
              id: 'U1',
              name: 'first user',
              gc_id: '1',
              channels: [
                'C1'
              ]
            }
          },
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '2'
            }
          }
        });

        graphCache = {
          users: {
            '1': 'U1'
          },
          channels: {
            '2': 'C1'
          },
          edges: {
            'MEMBER_OF': {}
          }
        };

        const gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id',
          jobQueue: mockScheduler
        });

        const jobDoneCallback = mockScheduler.calls.argsFor(0)[0].jobDone;

        jobDoneCallback({
          graph: {
            signals: [
              {
                action: 'edge_create',
                id: '3',
                name: 'MEMBER_OF',
                name_id: 'name id',
                from: '1',
                to: '2'
              }
            ]
          }
        });

        expect(storage.users.getSync('U1').gc_id).toEqual('1');
        expect(graphCache.edges['MEMBER_OF']['1-2']).toEqual('3');
    });
  });

  describe('testing channel created', () => {

    describe('when a new channel is created', () => {
      let mockScheduler;
      let storage;
      let graphCache;

      beforeEach(() => {
        mockScheduler = {
          addJob: jasmine.createSpy('addJob')
        };

        storage = memStorage({
          users: {},
          channels: {}
        });

        graphCache = {
          users: {},
          channels: {},
          edges: {
            'MEMBER_OF': {}
          }
        };

        const gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id',
          jobQueue: function() {
            return mockScheduler;
          }
        });

        const newChannel = {
          id: 'C1',
          name: 'first channel'
        }

        gcConnector.onChannelCreated(newChannel);
      });

      it('should send node_create signal', () => {

        expect(mockScheduler.addJob).toHaveBeenCalledWith({
          action: 'node_create',
          type: 'Channel',
          name: 'first channel',
          properties: {
            channel_id: 'C1'
          }
        });
      });

      it('should save the channel into storage', () => {
        expect(storage.channels.getSync('C1')).toEqual({
          id: 'C1',
          name: 'first channel'
        });
      });
    });

    describe('when a new channel with the same name as a deleted channel is created', () => {
      let mockScheduler;
      let storage;
      let graphCache;

      beforeEach(() => {
        mockScheduler = {
          addJob: jasmine.createSpy('addJob')
        };

        storage = memStorage({
          users: {},
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '1'
            }
          }
        });

        graphCache = {
          users: {},
          channels: {
            '1': 'C1'
          },
          edges: {
            'MEMBER_OF': {}
          }
        };

        const gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id',
          jobQueue: function() {
            return mockScheduler;
          }
        });

        const newChannel = {
          id: 'C2',
          name: 'first channel'
        }

        gcConnector.onChannelCreated(newChannel);
      });

      it('should send node_update signal', () => {
        expect(mockScheduler.addJob).toHaveBeenCalledWith({
          action: 'node_update',
          id: '1',
          properties: {
            channel_id: 'C2'
          },
          prev: {
            properties: {
              channel_id: 'C1'
            }
          }
        });
      });

      it('should update the Graph Commons id in channel storage', () => {
        expect(storage.channels.getSync('C2')).toEqual({
          id: 'C2',
          name: 'first channel',
          gc_id: '1'
        });
      });

      it('should update the GraphCommons id mapping for the channel', () => {
        expect(graphCache.channels['1']).toEqual('C2');
      });
    });
  });

  describe('testing requestChannelSuggestionsFor', () => {

    let gcConnector;
    const createSampleChannelSuggestion = function (channelName) {
      return {
        node: {
          id: channelName,
          name: channelName,
          type: {
            name: 'Channel'
          },
          properties: {
            channel_id: channelName
          }
        }
      };
    };

    beforeEach(() => {
      const storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            gc_id: '1'
          }
        },
        channels: {}
      });

      const graphCache = {
        users: {
          '1': 'U1'
        },
        channels: {},
        edges: {
          'MEMBER_OF': {}
        }
      };

      gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'graphid'
      });

    });



    it('should return empty result if there are no suggestions', (done) => {
      let scope = nock('https://graphcommons.com')
        .get('/api/v1/graphs/graphid/collab_filter?from=1&via=MEMBER_OF')
        .reply(200, {
          suggestions: []
        });

      const checker = function (resp) {
        expect(resp.length).toEqual(0);
        done();
      };

      gcConnector.requestChannelSuggestionsFor('U1').then(checker);
    });

    it('should return only channel ids from response', (done) => {
      let scope = nock('https://graphcommons.com')
        .get('/api/v1/graphs/graphid/collab_filter?from=1&via=MEMBER_OF')
        .reply(200, {
          suggestions: [
            createSampleChannelSuggestion('C1')
          ]
        });

      const checker = function (resp) {
        expect(resp.length).toEqual(1);
        expect(resp).toEqual(['C1']);
        done();
      };

      gcConnector.requestChannelSuggestionsFor('U1').then(checker);
    });

    it('should return max 4 results', (done) => {
      let scope = nock('https://graphcommons.com')
        .get('/api/v1/graphs/graphid/collab_filter?from=1&via=MEMBER_OF')
        .reply(200, {
          suggestions: [
            createSampleChannelSuggestion('C1'),
            createSampleChannelSuggestion('C2'),
            createSampleChannelSuggestion('C3'),
            createSampleChannelSuggestion('C4'),
            createSampleChannelSuggestion('C5')
          ]
        });

      const checker = function (resp) {
        expect(resp.length).toEqual(4);
        done();
      };

      gcConnector.requestChannelSuggestionsFor('U1').then(checker);
    });

    it('should not return results with undefined channel_id', (done) => {
      let faultyResult = createSampleChannelSuggestion('C1');
      faultyResult.node.properties.channel_id = null;

      let scope = nock('https://graphcommons.com')
        .get('/api/v1/graphs/graphid/collab_filter?from=1&via=MEMBER_OF')
        .reply(200, {
          suggestions: [
            faultyResult,
            createSampleChannelSuggestion('C2'),
          ]
        });

      const checker = function (resp) {
        expect(resp.length).toEqual(1);
        expect(resp).toEqual(['C2']);
        done();
      };

      gcConnector.requestChannelSuggestionsFor('U1').then(checker);
    });
  });

  describe('testing mentions', () => {
    let mockScheduler;
    let storage;
    let gcConnector;

    beforeEach(() => {
      mockScheduler = {
        addJob: jasmine.createSpy('addJob')
      };

      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first-user',
            gc_id: '1'
          },
          'U2': {
            id: 'U2',
            name: 'second-user',
            gc_id: '2'
          }
        },
        channels: {
          'C1': {
            id: 'C1',
            name: 'channel-one',
            gc_id: '3'
          }
        }
      });

      const graphCache = {
        users: {
          '1': 'U1',
          '2': 'U2'
        },
        channels: {
          '3': 'C1'
        },
        edges: {
          'MEMBER_OF': {}
        }
      };

      gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: function() {
          return mockScheduler;
        }
      });


    });

    it('should convert mention text to human readable username', (done) => {
      gcConnector.onMessageReceived({
        user: 'U1',
        channel: 'C1',
        ts: Date.now().toString(),
        text: 'Here I mention <@U2>'
      });

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      const createMessageSignal = createdSignals[0];
      expect(createMessageSignal.description).toEqual('Here I mention @second-user');
      done();
    });

    it('should convert all instances of the same mention in the text', (done) => {
      gcConnector.onMessageReceived({
        user: 'U1',
        channel: 'C1',
        ts: Date.now().toString(),
        text: 'Here I mention <@U2> again <@U2>'
      });

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      const createMessageSignal = createdSignals[0];
      expect(createMessageSignal.description).toEqual('Here I mention @second-user again @second-user');
      done();
    });

    it('should convert different user mentions in the text', (done) => {
      gcConnector.onMessageReceived({
        user: 'U1',
        channel: 'C1',
        ts: Date.now().toString(),
        text: 'Here I mention <@U2> and <@U1>'
      });

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      const createMessageSignal = createdSignals[0];
      expect(createMessageSignal.description).toEqual('Here I mention @second-user and @first-user');
      done();
    });

    it('should not throw error if mentioned user is not defined', (done) => {
      expect(() => {
        gcConnector.onMessageReceived({
          user: 'U1',
          channel: 'C1',
          ts: Date.now().toString(),
          text: 'Here I mention <@U5>'
        });
      }).not.toThrow();

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      const createMessageSignal = createdSignals[0];
      expect(createMessageSignal.description).toMatch(/<@U5/);
      done();
    });

    it('should create an edge signal for mentioned user', (done) => {
      const message = {
        user: 'U1',
        channel: 'C1',
        ts: Date.now().toString(),
        text: 'Here I mention <@U2>'
      };
      gcConnector.onMessageReceived(message);

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      const mentionEdgeSignal = createdSignals[createdSignals.length - 1];
      expect(mentionEdgeSignal).toEqual({
        action: 'edge_create',
        name: 'MENTIONS',
        from_type: 'Message',
        from_name: `first-user - ${message.ts}`,
        to_type: 'User',
        to_name: 'second-user'
      })
      done();
    });

    it('should not create duplicate edge when user is mentioned multiple times in a message', (done) => {
      const message = {
        user: 'U1',
        channel: 'C1',
        ts: Date.now().toString(),
        text: 'Here I mention <@U2> again <@U2>'
      };
      gcConnector.onMessageReceived(message);

      const createdSignals = mockScheduler.addJob.calls.argsFor(0)[0];
      expect(createdSignals.length).toBe(4);
      done();
    });
  });
});
