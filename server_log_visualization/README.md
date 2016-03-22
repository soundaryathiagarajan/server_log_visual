Step 1 : Download Kafka

https://www.apache.org/dyn/closer.cgi?path=/kafka/0.9.0.0/kafka_2.11-0.9.0.0.tgz

Step 2 : Extract

tar -xvf downloaded-tar-file cd kafka

Step 3 : Start the Server

Start the Zookeeper server :

bin/zookeeper-server-start.sh config/zookeeper.properties

Now start the Kafka server:

bin/kafka-server-start.sh config/server.properties

Step 4 : Create Topic

bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic test

bin/kafka-topics.sh --list --zookeeper localhost:2181 test

Step 5 : Producer

bin/kafka-console-producer.sh --broker-list localhost:9092 --topic test

Step 6 : Consumer

bin/kafka-console-consumer.sh --zookeeper localhost:2181 --topic test --from-beginning

Step 7 : Start the app

Pull the code
npm install
nodejs server.js
