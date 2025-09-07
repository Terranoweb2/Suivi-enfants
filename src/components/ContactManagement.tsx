import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  callFilteringService, 
  Contact, 
  WhitelistRequest 
} from '../services/callFilteringService';
import { formatDistanceToNow } from '../utils';
import Button from './Button';

interface ContactManagementProps {
  childId: string;
  onNavigateToDetails?: () => void;
  style?: any;
}

const ContactManagement: React.FC<ContactManagementProps> = ({
  childId,
  onNavigateToDetails,
  style,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingRequests, setPendingRequests] = useState<WhitelistRequest[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'whitelisted' | 'blocked'>('all');

  // Add contact form state
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    relationship: 'friend' as Contact['relationship'],
    allowCalls: true,
    allowSMS: true,
    priority: 'medium' as Contact['priority'],
  });

  useEffect(() => {
    loadData();
    
    // Set up listener for contact changes
    const unsubscribe = callFilteringService.addListener((event) => {
      if (event.type === 'contact_added' || 
          event.type === 'contact_updated' || 
          event.type === 'contact_removed' ||
          event.type === 'whitelist_request_created') {
        loadData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [childId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [allContacts, requests] = await Promise.all([
        callFilteringService.getContacts(),
        callFilteringService.getPendingWhitelistRequests(),
      ]);
      
      setContacts(allContacts);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    try {
      if (!newContact.name.trim() || !newContact.phoneNumber.trim()) {
        Alert.alert('Erreur', 'Nom et numéro de téléphone requis');
        return;
      }

      await callFilteringService.addContact({
        ...newContact,
        isWhitelisted: true,
        isBlocked: false,
        addedBy: user!.id,
      });

      setShowAddModal(false);
      setNewContact({
        name: '',
        phoneNumber: '',
        email: '',
        relationship: 'friend',
        allowCalls: true,
        allowSMS: true,
        priority: 'medium',
      });

      Alert.alert('Succès', 'Contact ajouté avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter le contact');
    }
  };

  const handleToggleBlock = async (contact: Contact) => {
    try {
      const action = contact.isBlocked ? 'débloquer' : 'bloquer';
      
      Alert.alert(
        `${action.charAt(0).toUpperCase() + action.slice(1)} le contact`,
        `Êtes-vous sûr de vouloir ${action} ${contact.name} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: action.charAt(0).toUpperCase() + action.slice(1),
            style: contact.isBlocked ? 'default' : 'destructive',
            onPress: async () => {
              const success = contact.isBlocked 
                ? await callFilteringService.unblockContact(contact.id)
                : await callFilteringService.blockContact(contact.id);
              
              if (success) {
                await loadData();
                Alert.alert('Succès', `Contact ${action}é`);
              } else {
                Alert.alert('Erreur', `Impossible de ${action} le contact`);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleToggleWhitelist = async (contact: Contact) => {
    try {
      const success = contact.isWhitelisted
        ? await callFilteringService.updateContact(contact.id, { isWhitelisted: false })
        : await callFilteringService.whitelistContact(contact.id);
      
      if (success) {
        await loadData();
        Alert.alert('Succès', contact.isWhitelisted ? 'Contact retiré de la liste blanche' : 'Contact ajouté à la liste blanche');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le statut');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleRemoveContact = (contact: Contact) => {
    Alert.alert(
      'Supprimer le contact',
      `Êtes-vous sûr de vouloir supprimer ${contact.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await callFilteringService.removeContact(contact.id);
            if (success) {
              await loadData();
              Alert.alert('Succès', 'Contact supprimé');
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer le contact');
            }
          },
        },
      ]
    );
  };

  const handleApproveRequest = async (request: WhitelistRequest) => {
    const success = await callFilteringService.reviewWhitelistRequest(
      request.id,
      true,
      user!.id,
      'Approved by parent'
    );
    
    if (success) {
      await loadData();
      Alert.alert('Succès', 'Demande approuvée et contact ajouté');
    } else {
      Alert.alert('Erreur', 'Impossible d\'approuver la demande');
    }
  };

  const handleDenyRequest = async (request: WhitelistRequest) => {
    Alert.prompt(
      'Refuser la demande',
      'Raison du refus (optionnel):',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async (reason) => {
            const success = await callFilteringService.reviewWhitelistRequest(
              request.id,
              false,
              user!.id,
              reason || 'Denied by parent'
            );
            
            if (success) {
              await loadData();
              Alert.alert('Succès', 'Demande refusée');
            } else {
              Alert.alert('Erreur', 'Impossible de refuser la demande');
            }
          },
        },
      ]
    );
  };

  const getFilteredContacts = (): Contact[] => {
    switch (filter) {
      case 'whitelisted':
        return contacts.filter(contact => contact.isWhitelisted);
      case 'blocked':
        return contacts.filter(contact => contact.isBlocked);
      default:
        return contacts;
    }
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship) {
      case 'parent':
        return 'person';
      case 'family':
        return 'people';
      case 'friend':
        return 'happy';
      case 'emergency':
        return 'medical';
      case 'school':
        return 'school';
      default:
        return 'person-outline';
    }
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case 'parent':
        return theme.colors.primary;
      case 'family':
        return theme.colors.secondary;
      case 'emergency':
        return theme.colors.error;
      case 'school':
        return theme.colors.warning;
      default:
        return theme.colors.gray[500];
    }
  };

  const renderContact = ({ item: contact }: { item: Contact }) => (
    <View style={[styles.contactCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <View style={[
            styles.contactAvatar,
            { backgroundColor: getRelationshipColor(contact.relationship) + '20' }
          ]}>
            <Ionicons 
              name={getRelationshipIcon(contact.relationship) as any} 
              size={20} 
              color={getRelationshipColor(contact.relationship)} 
            />
          </View>
          <View style={styles.contactDetails}>
            <Text style={[styles.contactName, { color: theme.colors.text }]}>
              {contact.name}
            </Text>
            <Text style={[styles.contactPhone, { color: theme.colors.gray[600] }]}>
              {contact.phoneNumber}
            </Text>
            <Text style={[styles.contactRelation, { color: theme.colors.gray[500] }]}>
              {contact.relationship} • {contact.priority} priority
            </Text>
          </View>
        </View>
        
        <View style={styles.contactActions}>
          <View style={styles.statusBadges}>
            {contact.isWhitelisted && (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.success }]}>
                <Text style={styles.statusText}>Autorisé</Text>
              </View>
            )}
            {contact.isBlocked && (
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.statusText}>Bloqué</Text>
              </View>
            )}
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: contact.isWhitelisted ? theme.colors.gray[400] : theme.colors.success }
              ]}
              onPress={() => handleToggleWhitelist(contact)}
            >
              <Ionicons 
                name={contact.isWhitelisted ? "checkmark-done" : "checkmark"} 
                size={16} 
                color={theme.colors.white} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: contact.isBlocked ? theme.colors.warning : theme.colors.error }
              ]}
              onPress={() => handleToggleBlock(contact)}
            >
              <Ionicons 
                name={contact.isBlocked ? "ban" : "close"} 
                size={16} 
                color={theme.colors.white} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.gray[500] }]}
              onPress={() => handleRemoveContact(contact)}
            >
              <Ionicons name="trash" size={16} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.contactPermissions}>
        <View style={styles.permissionItem}>
          <Ionicons 
            name={contact.allowCalls ? "call" : "call-slash"} 
            size={14} 
            color={contact.allowCalls ? theme.colors.success : theme.colors.error} 
          />
          <Text style={[styles.permissionText, { color: theme.colors.gray[600] }]}>
            Appels
          </Text>
        </View>
        <View style={styles.permissionItem}>
          <Ionicons 
            name={contact.allowSMS ? "chatbubble" : "chatbubble-slash"} 
            size={14} 
            color={contact.allowSMS ? theme.colors.success : theme.colors.error} 
          />
          <Text style={[styles.permissionText, { color: theme.colors.gray[600] }]}>
            SMS
          </Text>
        </View>
        {contact.lastContact && (
          <Text style={[styles.lastContact, { color: theme.colors.gray[500] }]}>
            Dernier contact: {formatDistanceToNow(contact.lastContact)}
          </Text>
        )}
      </View>
    </View>
  );

  const renderPendingRequest = ({ item: request }: { item: WhitelistRequest }) => (
    <View style={[styles.requestCard, { backgroundColor: theme.colors.warning + '10' }]}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={[styles.requestName, { color: theme.colors.text }]}>
            {request.requestedName}
          </Text>
          <Text style={[styles.requestPhone, { color: theme.colors.gray[600] }]}>
            {request.requestedNumber}
          </Text>
          <Text style={[styles.requestReason, { color: theme.colors.gray[500] }]}>
            Raison: {request.reason}
          </Text>
          <Text style={[styles.requestTime, { color: theme.colors.gray[500] }]}>
            {formatDistanceToNow(request.requestedAt)}
          </Text>
        </View>
        
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestButton, { backgroundColor: theme.colors.success }]}
            onPress={() => handleApproveRequest(request)}
          >
            <Ionicons name="checkmark" size={16} color={theme.colors.white} />
            <Text style={[styles.requestButtonText, { color: theme.colors.white }]}>
              Approuver
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.requestButton, { backgroundColor: theme.colors.error }]}
            onPress={() => handleDenyRequest(request)}
          >
            <Ionicons name="close" size={16} color={theme.colors.white} />
            <Text style={[styles.requestButtonText, { color: theme.colors.white }]}>
              Refuser
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderAddContactModal = () => (
    <Modal
      visible={showAddModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Ajouter un contact
            </Text>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                Nom *
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: theme.colors.gray[300] }]}
                value={newContact.name}
                onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                placeholder="Nom du contact"
                placeholderTextColor={theme.colors.gray[500]}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                Numéro de téléphone *
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: theme.colors.gray[300] }]}
                value={newContact.phoneNumber}
                onChangeText={(text) => setNewContact({ ...newContact, phoneNumber: text })}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={theme.colors.gray[500]}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                Relation
              </Text>
              <View style={styles.relationButtons}>
                {['parent', 'family', 'friend', 'emergency', 'school', 'other'].map((relation) => (
                  <TouchableOpacity
                    key={relation}
                    style={[
                      styles.relationButton,
                      newContact.relationship === relation && { backgroundColor: theme.colors.primary },
                      { borderColor: theme.colors.primary }
                    ]}
                    onPress={() => setNewContact({ ...newContact, relationship: relation as Contact['relationship'] })}
                  >
                    <Text style={[
                      styles.relationButtonText,
                      newContact.relationship === relation 
                        ? { color: theme.colors.white }
                        : { color: theme.colors.primary }
                    ]}>
                      {relation}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              title="Annuler"
              onPress={() => setShowAddModal(false)}
              variant="outline"
              style={styles.modalButton}
            />
            <Button
              title="Ajouter"
              onPress={handleAddContact}
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.LG,
    },
    title: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      backgroundColor: theme.colors.primary,
      gap: theme.spacing.XS,
    },
    addButtonText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    pendingSection: {
      marginBottom: theme.spacing.LG,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
      marginBottom: theme.spacing.LG,
    },
    filterButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    activeFilterButton: {
      backgroundColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.primary,
    },
    activeFilterButtonText: {
      color: theme.colors.white,
    },
    contactCard: {
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.MD,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    contactHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.SM,
    },
    contactInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    contactAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.SM,
    },
    contactDetails: {
      flex: 1,
    },
    contactName: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: 2,
    },
    contactPhone: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginBottom: 2,
    },
    contactRelation: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
    },
    contactActions: {
      alignItems: 'flex-end',
    },
    statusBadges: {
      flexDirection: 'row',
      gap: theme.spacing.XS,
      marginBottom: theme.spacing.SM,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: 2,
      borderRadius: 10,
    },
    statusText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.BOLD,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.spacing.XS,
    },
    actionButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactPermissions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.MD,
      paddingTop: theme.spacing.SM,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray[200],
    },
    permissionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.XS,
    },
    permissionText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
    },
    lastContact: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      marginLeft: 'auto',
    },
    requestCard: {
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.MD,
    },
    requestHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    requestInfo: {
      flex: 1,
      marginRight: theme.spacing.MD,
    },
    requestName: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: 2,
    },
    requestPhone: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginBottom: 2,
    },
    requestReason: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginBottom: 2,
    },
    requestTime: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
    },
    requestActions: {
      gap: theme.spacing.SM,
    },
    requestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: theme.spacing.XS,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      gap: theme.spacing.XS,
    },
    requestButtonText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.XL,
      margin: theme.spacing.XL,
      maxHeight: '80%',
      width: '90%',
    },
    modalTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      marginBottom: theme.spacing.LG,
      textAlign: 'center',
    },
    formField: {
      marginBottom: theme.spacing.LG,
    },
    fieldLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: theme.spacing.SM,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
    },
    relationButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.SM,
    },
    relationButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
    },
    relationButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.MD,
      marginTop: theme.spacing.LG,
    },
    modalButton: {
      flex: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.XL,
    },
    emptyText: {
      color: theme.colors.gray[600],
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des contacts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={16} color={theme.colors.white} />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>
            Demandes en attente ({pendingRequests.length})
          </Text>
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingRequest}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'whitelisted', 'blocked'].map((filterValue) => (
          <TouchableOpacity
            key={filterValue}
            style={[
              styles.filterButton,
              filter === filterValue && styles.activeFilterButton,
            ]}
            onPress={() => setFilter(filterValue as typeof filter)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === filterValue && styles.activeFilterButtonText,
            ]}>
              {filterValue === 'all' ? 'Tous' : 
               filterValue === 'whitelisted' ? 'Autorisés' : 'Bloqués'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contacts List */}
      <FlatList
        data={getFilteredContacts()}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {filter === 'all' ? 'Aucun contact' :
               filter === 'whitelisted' ? 'Aucun contact autorisé' : 'Aucun contact bloqué'}
            </Text>
          </View>
        )}
      />

      {onNavigateToDetails && (
        <Button
          title="Voir les détails"
          onPress={onNavigateToDetails}
          variant="outline"
          style={{ marginTop: theme.spacing.MD }}
        />
      )}

      {renderAddContactModal()}
    </View>
  );
};

export default ContactManagement;