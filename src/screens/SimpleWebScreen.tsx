import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SimpleWebScreen: React.FC = () => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f0f0',
      padding: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#1E90FF',
      marginBottom: 20,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 18,
      color: '#666',
      textAlign: 'center',
      marginBottom: 30,
    },
    card: {
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      maxWidth: 500,
      width: '100%',
    },
    text: {
      fontSize: 16,
      color: '#333',
      lineHeight: 24,
      textAlign: 'center',
    },
    status: {
      fontSize: 14,
      color: '#4CAF50',
      fontWeight: '600',
      marginTop: 20,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>TerranoKidsFind</Text>
        <Text style={styles.subtitle}>Version Web - Test Simple</Text>
        <Text style={styles.text}>
          🎉 Félicitations ! L'application React Native fonctionne correctement sur le web.
        </Text>
        <Text style={styles.text}>
          Cette version simplifiée confirme que la configuration de base est opérationnelle.
        </Text>
        <Text style={styles.status}>✅ Application Web Fonctionnelle</Text>
      </View>
    </View>
  );
};

export default SimpleWebScreen;
